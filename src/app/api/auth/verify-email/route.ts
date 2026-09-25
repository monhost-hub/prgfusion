import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "node:crypto";

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Verifies a user's email address using a one-time token.
 *
 * Flow:
 *   1. Read raw token from query param
 *   2. Hash it (SHA-256) — the DB stores only the hash
 *   3. Look up VerificationToken by (hashed token, type="email_verify")
 *   4. Check expiration
 *   5. Look up User by identifier (email)
 *   6. Set User.emailVerified = NOW()
 *   7. Delete the token (one-time use)
 *   8. Redirect to /dashboard?verified=1 (frontend shows success toast)
 *
 * Security:
 *   - Raw token is NEVER stored in DB
 *   - Token is one-time use (deleted after success)
 *   - Token expires after 24h
 *   - Type is strictly checked ("email_verify" only — never "password_reset")
 *   - No information leakage: all error cases redirect to the same page
 *   - Token is never logged
 *
 * On success → redirect to /{locale}/dashboard?verified=1
 * On error → redirect to /{locale}/dashboard?verified=error
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawToken = searchParams.get("token");

  // Determine locale for redirect (default fr)
  const acceptLang = req.headers.get("accept-language") || "fr";
  const locale = acceptLang.startsWith("es") ? "es" : acceptLang.startsWith("en") ? "en" : "fr";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://allcombiner.com";

  if (!rawToken || rawToken.length < 32) {
    return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=error`);
  }

  // Hash the raw token to compare with DB
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  // Look up the token — must be type="email_verify"
  const tokenRow = await db.verificationToken
    .findUnique({ where: { token: hashedToken } })
    .catch(() => null);

  if (!tokenRow || tokenRow.type !== "email_verify") {
    return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=error`);
  }

  // Check expiration
  if (tokenRow.expires < new Date()) {
    // Clean up expired token
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=expired`);
  }

  // Look up the user by email (identifier)
  const user = await db.user
    .findUnique({ where: { email: tokenRow.identifier } })
    .catch(() => null);

  if (!user) {
    // User was deleted after token was issued — clean up and redirect
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=error`);
  }

  // Already verified? Still delete the token and redirect as success
  if (user.emailVerified) {
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=already`);
  }

  // Success: mark email as verified + delete token (one-time use)
  try {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date(), updatedAt: new Date() },
      }),
      db.verificationToken.delete({ where: { token: hashedToken } }),
    ]);
  } catch {
    // Transaction failed (e.g. race condition — token already deleted)
    return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=error`);
  }

  return NextResponse.redirect(`${appUrl}/${locale}/dashboard?verified=1`);
}
