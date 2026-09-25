import { NextRequest, NextResponse } from "next/server";
import { apiRoute, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { sendEmail, buildVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";

/**
 * POST /api/auth/register
 * Body: { email, name?, password, locale? }
 *
 * Creates a new USER account with emailVerified=null.
 * Generates a verification token (hashed in DB) and sends a verification email.
 * Auto-login behavior is preserved — the signup form handles that client-side.
 */

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generates a verification token and stores its SHA-256 hash in the DB.
 * Returns the raw token (to be embedded in the email link) — this is the
 * ONLY time the raw token exists in memory. It is never logged.
 *
 * Before inserting, deletes any existing email_verify tokens for this email
 * (one active token at a time). Never touches password_reset tokens.
 */
async function createEmailVerificationToken(email: string): Promise<string> {
  // Delete previous email_verify tokens for this email (idempotent)
  await db.verificationToken
    .deleteMany({ where: { identifier: email, type: "email_verify" } })
    .catch(() => {});

  const rawToken = randomBytes(32).toString("hex");
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await db.verificationToken.create({
    data: {
      identifier: email,
      token: hashedToken,
      expires,
      type: "email_verify",
    },
  });

  return rawToken;
}

export const POST = apiRoute(async (req: NextRequest) => {
  const ip = clientIp(req);
  if (!rateLimit("auth", `ip:${ip}`)) {
    throw new HttpError(429, "Too many attempts. Please try again later.");
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const name = String(body?.name || "").trim() || null;
  const password = String(body?.password || "");
  const locale = String(body?.locale || "fr").trim().toLowerCase().slice(0, 2);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Invalid email.");
  }
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }
  if (password.length > 200) {
    throw new HttpError(400, "Password too long.");
  }
  if (name && name.length > 100) {
    throw new HttpError(400, "Name too long.");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Create user with emailVerified = null (will be set when they click the email link)
  await db.user.create({
    data: { email, name, passwordHash, role: "USER", emailVerified: null },
  });

  // Generate verification token + send email
  // Failures here are non-fatal — user can still log in and request resend
  let emailSent = false;
  try {
    const rawToken = await createEmailVerificationToken(email);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://allcombiner.com";
    const verifyUrl = `${appUrl}/${locale}/verify-email?token=${rawToken}`;
    const emailContent = buildVerificationEmail(locale, verifyUrl);
    const result = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    emailSent = result.sent;
    if (!result.sent) {
      console.error("[register] Email verification send failed:", result.error);
    }
  } catch (err) {
    // Log the error but don't fail the registration — user can resend later
    console.error("[register] Email verification send failed:", err instanceof Error ? err.message : "unknown");
  }

  return NextResponse.json({ ok: true, emailSent });
});
