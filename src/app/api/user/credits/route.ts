import { NextResponse } from "next/server";
import { apiRoute, requireAuth, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/user/credits
 *
 * Returns the current user's credit balance.
 * Requires authentication.
 *
 * Returns:
 *   { credits: number }
 */
export const GET = apiRoute(async () => {
  const session = await requireAuth();
  const userId = session.user!.id!;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user) {
    throw new HttpError(404, "User not found.");
  }

  return NextResponse.json({ credits: user.credits });
});
