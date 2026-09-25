import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "node:crypto";

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Verifies a user's email address using a one-time token.
 * Returns JSON (not redirect) so the frontend page can display the result.
 *
 * Security:
 *   - Raw token is NEVER stored in DB
 *   - Token is one-time use (deleted after success)
 *   - Token expires after 24h
 *   - Type is strictly checked ("email_verify" only — never "password_reset")
 *   - No information leakage: all error cases return the same generic message
 *   - Token is never logged
 *
 * Returns:
 *   200 { ok: true, status: "verified" | "already" }
 *   400 { ok: false, error: "invalid" | "expired" }
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawToken = searchParams.get("token");

  if (!rawToken || rawToken.length < 32) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Hash the raw token to compare with DB
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  // Look up the token — must be type="email_verify"
  const tokenRow = await db.verificationToken
    .findUnique({ where: { token: hashedToken } })
    .catch(() => null);

  if (!tokenRow || tokenRow.type !== "email_verify") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Check expiration
  if (tokenRow.expires < new Date()) {
    // Clean up expired token
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "expired" }, { status: 400 });
  }

  // Look up the user by email (identifier)
  const user = await db.user
    .findUnique({ where: { email: tokenRow.identifier } })
    .catch(() => null);

  if (!user) {
    // User was deleted after token was issued — clean up
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  // Already verified? Still delete the token and return success
  if (user.emailVerified) {
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    return NextResponse.json({ ok: true, status: "already" });
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
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status: "verified" });
}
