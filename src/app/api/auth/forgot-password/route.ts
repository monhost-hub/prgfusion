import { NextRequest, NextResponse } from "next/server";
import { apiRoute, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { sendEmail, buildPasswordResetEmail } from "@/lib/email";
import { randomBytes, createHash } from "node:crypto";

/**
 * POST /api/auth/forgot-password
 * Body: { email, locale? }
 *
 * Requests a password reset link.
 *
 * Security:
 *   - ALWAYS returns 200 (anti-enumeration — never reveals if email exists)
 *   - Rate limited: per-IP (10/hour) + per-email (3/hour)
 *   - Token: crypto.randomBytes(32), hashed with SHA-256 before DB storage
 *   - Token type: "password_reset" (never touches "email_verify" tokens)
 *   - Token expires in 1 hour
 *   - Old password_reset tokens for this email are invalidated before creating new one
 *   - Raw token NEVER stored in DB, NEVER logged
 *   - Email is sent only if the account exists — silently no-ops otherwise
 */

const TOKEN_EXPIRY_MINUTES = 60;

export const POST = apiRoute(async (req: NextRequest) => {
  const ip = clientIp(req);

  // Rate limit: 10/hour per-IP (prevents mass probing)
  if (!rateLimit("auth", `ip:${ip}`)) {
    // Still return 200 to avoid revealing rate limit behavior
    return NextResponse.json({ ok: true });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    // Still 200 — never reveal that the request was invalid
    return NextResponse.json({ ok: true });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const locale = String(body?.locale || "fr").trim().toLowerCase().slice(0, 2);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    // Still 200 — never reveal that the email was invalid
    return NextResponse.json({ ok: true });
  }

  // Rate limit: 3/hour per-email (prevents spamming a specific account)
  if (!rateLimit("password_reset", `email:${email}`, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: true });
  }

  // Look up the user — if not found, silently return 200
  const user = await db.user.findUnique({ where: { email } }).catch(() => null);

  if (!user) {
    // No account found — return 200 without sending any email
    return NextResponse.json({ ok: true });
  }

  try {
    // Invalidate old password_reset tokens for this email (never touch email_verify)
    await db.verificationToken
      .deleteMany({ where: { identifier: email, type: "password_reset" } })
      .catch(() => {});

    // Generate new token
    const rawToken = randomBytes(32).toString("hex");
    const hashedToken = createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await db.verificationToken.create({
      data: {
        identifier: email,
        token: hashedToken,
        expires,
        type: "password_reset",
      },
    });

    // Send the email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://allcombiner.com";
    const resetUrl = `${appUrl}/${locale}/reset-password?token=${rawToken}`;
    const emailContent = buildPasswordResetEmail(locale, resetUrl);

    await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  } catch (err) {
    // Log error server-side but still return 200 (never reveal failure to client)
    console.error("[forgot-password] Error:", err instanceof Error ? err.message : "unknown");
  }

  // Always return 200 — never reveal whether the email exists
  return NextResponse.json({ ok: true });
});
