import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/users/[id] — update role
 * DELETE /api/admin/users/[id] — delete user
 */
export const PATCH = apiRoute(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json();

  if (body?.role) {
    const role = String(body.role).toUpperCase();
    if (!["USER", "ADMIN"].includes(role)) throw new HttpError(400, "Invalid role.");
    if (id === session.user!.id && role !== "ADMIN") {
      throw new HttpError(400, "You cannot demote yourself.");
    }
    const user = await db.user.update({ where: { id }, data: { role } });
    return NextResponse.json({ user: { id: user.id, role: user.role } });
  }

  throw new HttpError(400, "Nothing to update.");
});

export const DELETE = apiRoute(async (_req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  if (id === session.user!.id) {
    throw new HttpError(400, "You cannot delete yourself.");
  }
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "User not found.");
  await db.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
