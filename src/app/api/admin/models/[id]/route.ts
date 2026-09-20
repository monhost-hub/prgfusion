import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/models/[id] — update an existing model
 * DELETE /api/admin/models/[id] — delete a model
 */
export const PATCH = apiRoute(async (req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await db.aIModel.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Model not found.");

  const data: any = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (typeof body?.providerId === "string") data.providerId = body.providerId.trim();
  if (typeof body?.provider === "string") data.provider = body.provider.trim();
  if (typeof body?.description === "string") data.description = body.description.trim();
  if (typeof body?.costPerCall === "number" && Number.isFinite(body.costPerCall)) {
    data.costPerCall = body.costPerCall;
  }
  if (typeof body?.creditCost === "number" && Number.isFinite(body.creditCost) && body.creditCost >= 1) {
    data.creditCost = Math.floor(body.creditCost);
  }
  if (typeof body?.enabled === "boolean") {
    data.enabled = body.enabled;
    if (!body.enabled && existing.isActive) data.isActive = false;
  }
  if (typeof body?.isActive === "boolean" && body.isActive) {
    // activating this model → deactivate others
    await db.aIModel.updateMany({ data: { isActive: false } });
    data.isActive = true;
    data.enabled = true;
  } else if (typeof body?.isActive === "boolean" && !body.isActive) {
    data.isActive = false;
  }

  const model = await db.aIModel.update({ where: { id }, data });
  return NextResponse.json({ model });
});

export const DELETE = apiRoute(async (_req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const existing = await db.aIModel.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Model not found.");
  if (existing.isActive) {
    throw new HttpError(400, "Cannot delete the active model. Activate another model first.");
  }
  await db.aIModel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
