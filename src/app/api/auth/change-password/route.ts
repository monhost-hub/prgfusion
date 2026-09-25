import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAuth, HttpError } from "@/lib/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/change-password
 *
 * Body: { currentPassword, newPassword }
 *
 * Flow:
 *   1. Require auth
 *   2. Validate input (newPassword min 8 chars)
 *   3. Fetch user from DB (with passwordHash + sessionVersion)
 *   4. Verify currentPassword against stored hash
 *   5. Hash newPassword with bcrypt (cost 12)
 *   6. Update User.passwordHash + increment sessionVersion
 *   7. Return success (client should redirect to login)
 *
 * Security:
 *   - Current password is verified server-side — never trust client
 *   - sessionVersion is incremented → old JWTs become invalid
 *   - Rate limited via apiRoute (auth family)
 *   - Never logs passwords
 *
 * Returns:
 *   200 { ok: true } — password changed
 *   400 { error: "..." } — validation error
 *   401 { error: "..." } — not authenticated
 *   403 { error: "..." } — current password incorrect
 */
export const POST = apiRoute(async (req: NextRequest) => {
  // 1. Auth
  const session = await requireAuth();
  const userId = session.user!.id!;

  // 2. Parse + validate
  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid request.");
  }

  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (!currentPassword) {
    throw new HttpError(400, "Current password is required.");
  }
  if (newPassword.length < 8) {
    throw new HttpError(400, "New password must be at least 8 characters.");
  }
  if (newPassword.length > 200) {
    throw new HttpError(400, "Password too long.");
  }
  if (currentPassword === newPassword) {
    throw new HttpError(400, "New password must be different from current password.");
  }

  // 3. Fetch user
  const user = await db.user
    .findUnique({ where: { id: userId }, select: { id: true, passwordHash: true, sessionVersion: true } })
    .catch(() => null);

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  // 4. Verify current password
  const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordOk) {
    throw new HttpError(403, "Current password is incorrect.");
  }

  // 5. Hash new password
  const newHash = await bcrypt.hash(newPassword, 12);

  // 6. Update password + increment sessionVersion (invalidates old JWTs)
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: newHash,
      sessionVersion: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
});
