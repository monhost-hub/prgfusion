import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { setActiveModel } from "@/lib/ai/fusion";
import { db } from "@/lib/db";

/**
 * POST /api/admin/models/[id]/activate
 * Sets this model as the single active model used for all future generations.
 * (This is the endpoint the "change model from admin" test verifies.)
 */
export const POST = apiRoute(async (_req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  await setActiveModel(id);
  const model = await db.aIModel.findUnique({ where: { id } });
  return NextResponse.json({ ok: true, model });
});
