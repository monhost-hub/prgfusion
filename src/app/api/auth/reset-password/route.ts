import { NextRequest, NextResponse } from "next/server";
import { apiRoute, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Resets a user's password using a one-time token received by email.
 *
 * Flow:
 *   1. Validate token + password are present
 *   2. Hash the raw token (SHA-256) for DB lookup
 *   3. Look up VerificationToken — must be type="password_reset"
 *   4. Check expiration (1 hour)
 *   5. Look up User by email (identifier)
 *   6. Validate password length (min 8 chars)
 *   7. Hash password with bcrypt (cost 12 — same as register)
 *   8. Update User.passwordHash + increment sessionVersion
 *   9. Delete the token (one-time use)
 *
 * Security:
 *   - Token is never logged
 *   - Token is one-time use (deleted after success)
 *   - type="password_reset" strictly enforced (never accepts email_verify tokens)
 *   - Rate limited: 10/hour per-IP
 *   - sessionVersion is incremented (JWT invalidation logic will be added
 *     in a separate commit — for now this is just a DB increment)
 *   - Password is hashed with bcrypt cost 12 (same as register)
 *
 * Returns:
 *   200 { ok: true } — password changed successfully
 *   400 { error: "..." } — invalid/missing token, password too short
 *   410 { error: "expired" } — token expired
 *   429 { error: "rate_limited" } — too many attempts
 */

export const POST = apiRoute(async (req: NextRequest) => {
  const ip = clientIp(req);
  if (!rateLimit("auth", `ip:${ip}`)) {
    throw new HttpError(429, "Too many attempts. Please try again later.");
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid request.");
  }

  const rawToken = String(body?.token || "");
  const password = String(body?.password || "");

  // Validate token presence
  if (!rawToken || rawToken.length < 32) {
    throw new HttpError(400, "Invalid or missing token.");
  }

  // Validate password length
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }
  if (password.length > 200) {
    throw new HttpError(400, "Password too long.");
  }

  // Hash the raw token for DB lookup
  const hashedToken = createHash("sha256").update(rawToken).digest("hex");

  // Look up the token — must be type="password_reset"
  const tokenRow = await db.verificationToken
    .findUnique({ where: { token: hashedToken } })
    .catch(() => null);

  if (!tokenRow || tokenRow.type !== "password_reset") {
    throw new HttpError(400, "Invalid or expired token.");
  }

  // Check expiration
  if (tokenRow.expires < new Date()) {
    // Clean up expired token
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    throw new HttpError(410, "This reset link has expired. Please request a new one.");
  }

  // Look up the user by email (identifier)
  const user = await db.user
    .findUnique({ where: { email: tokenRow.identifier } })
    .catch(() => null);

  if (!user) {
    // User was deleted after token was issued — clean up
    await db.verificationToken.delete({ where: { token: hashedToken } }).catch(() => {});
    throw new HttpError(400, "Invalid or expired token.");
  }

  // Hash the new password with bcrypt (cost 12 — same as register)
  const passwordHash = await bcrypt.hash(password, 12);

  // Update password + increment sessionVersion + delete token in a single transaction
  try {
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          // Increment sessionVersion — this will be used to invalidate JWTs
          // in a future commit. For now it's just a DB counter.
          sessionVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      }),
      db.verificationToken.delete({ where: { token: hashedToken } }),
    ]);
  } catch (err) {
    // Transaction failed (e.g. token already deleted by a concurrent request)
    console.error("[reset-password] Transaction failed:", err instanceof Error ? err.message : "unknown");
    throw new HttpError(400, "Invalid or expired token.");
  }

  return NextResponse.json({ ok: true });
});
