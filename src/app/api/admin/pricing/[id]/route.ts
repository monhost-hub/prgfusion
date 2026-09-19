import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/pricing/[id] — update plan
 * DELETE /api/admin/pricing/[id] — delete plan
 */
export const PATCH = apiRoute(async (req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await db.pricingPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Plan not found.");

  const data: any = {};
  if (typeof body?.slug === "string") data.slug = body.slug.trim().toLowerCase();
  if (typeof body?.nameJson === "object") data.nameJson = JSON.stringify(body.nameJson);
  if (typeof body?.description === "string") data.description = body.description.trim();
  if (typeof body?.priceMonthly === "number") data.priceMonthly = body.priceMonthly;
  if (typeof body?.priceYearly === "number") data.priceYearly = body.priceYearly;
  if (typeof body?.currency === "string") data.currency = body.currency.trim();
  if (typeof body?.credits === "number") data.credits = body.credits;
  if (typeof body?.featured === "boolean") data.featured = body.featured;
  if (typeof body?.enabled === "boolean") data.enabled = body.enabled;
  if (typeof body?.sortOrder === "number") data.sortOrder = body.sortOrder;

  const plan = await db.pricingPlan.update({ where: { id }, data });
  return NextResponse.json({ plan });
});

export const DELETE = apiRoute(async (_req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const existing = await db.pricingPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Plan not found.");
  await db.pricingPlan.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
