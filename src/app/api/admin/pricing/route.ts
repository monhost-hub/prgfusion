import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/pricing — list all plans
 * POST /api/admin/pricing — create a new plan
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const plans = await db.pricingPlan.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ plans });
});

export const POST = apiRoute(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();

  const slug = String(body?.slug || "").trim().toLowerCase();
  const nameJson = body?.nameJson ?? {};
  const description = String(body?.description || "").trim();
  const priceMonthly = Number(body?.priceMonthly || 0);
  const priceYearly = Number(body?.priceYearly || 0);
  const currency = String(body?.currency || "USD").trim();
  const credits = Number(body?.credits || 0);
  const featured = Boolean(body?.featured ?? false);
  const enabled = Boolean(body?.enabled ?? true);
  const sortOrder = Number(body?.sortOrder || 0);

  if (!slug) throw new HttpError(400, "slug is required.");
  if (typeof nameJson !== "object" || !nameJson.en) {
    throw new HttpError(400, "nameJson must include at least an 'en' field.");
  }
  if (!Number.isFinite(priceMonthly) || priceMonthly < 0) throw new HttpError(400, "Invalid priceMonthly.");
  if (!Number.isFinite(credits) || credits < 0) throw new HttpError(400, "Invalid credits.");

  const plan = await db.pricingPlan.create({
    data: {
      slug,
      nameJson: JSON.stringify(nameJson),
      description,
      priceMonthly,
      priceYearly,
      currency,
      credits,
      featured,
      enabled,
      sortOrder,
    },
  });
  return NextResponse.json({ plan });
});
