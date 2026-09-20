import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/payments/plans — list all ENABLED plans with Whop config
 *   (legacy/duplicate plans are filtered out)
 * POST /api/admin/payments/plans — create a new plan
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const plans = await db.pricingPlan.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { whopPayments: true, planChanges: true } } },
  });
  return NextResponse.json({ plans });
});

const ALLOWED_CURRENCIES = ["EUR", "USD", "GBP"];
const ALLOWED_BILLING_PERIODS = ["monthly", "yearly", "one_time", null];

export const POST = apiRoute(async (req: NextRequest) => {
  const session = await requireAdmin();
  const adminId = session.user!.id!;
  const body = await req.json();

  // === Validate input server-side ===
  const slug = String(body?.slug || "").trim().toLowerCase();
  const nameEn = String(body?.nameEn || "").trim();
  const nameFr = String(body?.nameFr || "").trim();
  const nameEs = String(body?.nameEs || "").trim();
  const description = String(body?.description || "").trim();
  const priceMonthly = Number(body?.priceMonthly);
  const priceYearly = Number(body?.priceYearly ?? body?.priceMonthly);
  const currency = String(body?.currency || "EUR").trim().toUpperCase();
  const credits = parseInt(String(body?.credits ?? 0), 10);
  const featured = Boolean(body?.featured ?? false);
  const enabled = Boolean(body?.enabled ?? true);
  const sortOrder = parseInt(String(body?.sortOrder ?? 0), 10);
  const whopPlanId = body?.whopPlanId ? String(body.whopPlanId).trim() : null;
  const whopCheckoutUrl = body?.whopCheckoutUrl ? String(body.whopCheckoutUrl).trim() : null;
  const billingPeriod = body?.billingPeriod ? String(body.billingPeriod).trim() : null;

  if (!slug) throw new HttpError(400, "slug is required.");
  if (!nameEn) throw new HttpError(400, "nameEn is required.");
  if (!Number.isFinite(priceMonthly) || priceMonthly < 0) throw new HttpError(400, "Invalid priceMonthly.");
  if (!ALLOWED_CURRENCIES.includes(currency)) throw new HttpError(400, `currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`);
  if (!Number.isFinite(credits) || credits < 0) throw new HttpError(400, "credits must be a positive integer.");
  if (whopPlanId && !/^plan_[a-zA-Z0-9]+$/.test(whopPlanId)) throw new HttpError(400, "whopPlanId must match format 'plan_xxx'");
  if (whopCheckoutUrl && !/^https:\/\/(www\.)?(whop\.com|whop\.checkout\.com)/i.test(whopCheckoutUrl)) {
    throw new HttpError(400, "whopCheckoutUrl must be a https://whop.com URL");
  }
  if (billingPeriod && !ALLOWED_BILLING_PERIODS.includes(billingPeriod)) {
    throw new HttpError(400, `billingPeriod must be one of: ${ALLOWED_BILLING_PERIODS.filter(Boolean).join(", ")}`);
  }

  const existing = await db.pricingPlan.findUnique({ where: { slug } }).catch(() => null);
  if (existing) throw new HttpError(409, "A plan with this slug already exists.");

  const plan = await db.pricingPlan.create({
    data: {
      id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      slug,
      nameJson: JSON.stringify({ en: nameEn, fr: nameFr || nameEn, es: nameEs || nameEn }),
      description,
      priceMonthly,
      priceYearly,
      currency,
      credits,
      featured,
      enabled,
      sortOrder,
      whopPlanId,
      whopCheckoutUrl,
      billingPeriod,
      updatedAt: new Date(),
    },
  });

  // Log the creation
  await db.pricingPlanChange.create({
    data: {
      id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      planId: plan.id,
      adminId,
      field: "__created__",
      oldValue: null,
      newValue: JSON.stringify({ slug, priceMonthly, credits, whopPlanId }),
    },
  }).catch(() => {});

  return NextResponse.json({ plan });
});
