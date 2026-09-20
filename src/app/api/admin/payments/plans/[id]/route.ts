import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * PATCH /api/admin/payments/plans/[id] — update an existing plan
 *   All changes are logged in PricingPlanChange for audit.
 *
 * GET /api/admin/payments/plans/[id]/history — returns the change history
 *   (handled via GET on the same route)
 */
const ALLOWED_CURRENCIES = ["EUR", "USD", "GBP"];
const ALLOWED_BILLING_PERIODS = ["monthly", "yearly", "one_time"];

const SENSITIVE_FIELDS = new Set([
  "whopPlanId",
  "whopCheckoutUrl",
  "priceMonthly",
  "credits",
]);

export const PATCH = apiRoute(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const adminId = session.user!.id!;
  const { id } = await ctx.params;
  const body = await req.json();

  const existing = await db.pricingPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Plan not found.");

  const data: any = {};
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Process each field with validation
  if (typeof body?.nameEn === "string" || typeof body?.nameFr === "string" || typeof body?.nameEs === "string") {
    let parsed: any = {};
    try { parsed = JSON.parse(existing.nameJson); } catch {}
    const newName = {
      en: body.nameEn ?? parsed.en ?? "",
      fr: body.fr ?? body.nameFr ?? parsed.fr ?? parsed.en ?? "",
      es: body.es ?? body.nameEs ?? parsed.es ?? parsed.en ?? "",
    };
    data.nameJson = JSON.stringify(newName);
    changes.push({ field: "nameJson", oldValue: existing.nameJson, newValue: data.nameJson });
  }
  if (typeof body?.description === "string") {
    data.description = body.description.trim();
    changes.push({ field: "description", oldValue: existing.description, newValue: data.description });
  }
  if (typeof body?.priceMonthly === "number") {
    if (!Number.isFinite(body.priceMonthly) || body.priceMonthly < 0) {
      throw new HttpError(400, "priceMonthly must be a positive number.");
    }
    data.priceMonthly = body.priceMonthly;
    changes.push({ field: "priceMonthly", oldValue: existing.priceMonthly, newValue: data.priceMonthly });
  }
  if (typeof body?.priceYearly === "number") {
    if (!Number.isFinite(body.priceYearly) || body.priceYearly < 0) {
      throw new HttpError(400, "priceYearly must be a positive number.");
    }
    data.priceYearly = body.priceYearly;
    changes.push({ field: "priceYearly", oldValue: existing.priceYearly, newValue: data.priceYearly });
  }
  if (typeof body?.currency === "string") {
    const c = body.currency.trim().toUpperCase();
    if (!ALLOWED_CURRENCIES.includes(c)) {
      throw new HttpError(400, `currency must be one of: ${ALLOWED_CURRENCIES.join(", ")}`);
    }
    data.currency = c;
    changes.push({ field: "currency", oldValue: existing.currency, newValue: c });
  }
  if (typeof body?.credits === "number") {
    if (!Number.isFinite(body.credits) || body.credits < 0 || !Number.isInteger(body.credits)) {
      throw new HttpError(400, "credits must be a positive integer.");
    }
    data.credits = body.credits;
    changes.push({ field: "credits", oldValue: existing.credits, newValue: body.credits });
  }
  if (typeof body?.featured === "boolean") {
    data.featured = body.featured;
    changes.push({ field: "featured", oldValue: existing.featured, newValue: body.featured });
  }
  if (typeof body?.enabled === "boolean") {
    data.enabled = body.enabled;
    changes.push({ field: "enabled", oldValue: existing.enabled, newValue: body.enabled });
  }
  if (typeof body?.sortOrder === "number") {
    data.sortOrder = body.sortOrder;
    changes.push({ field: "sortOrder", oldValue: existing.sortOrder, newValue: body.sortOrder });
  }
  if (body?.whopPlanId !== undefined) {
    const v = body.whopPlanId ? String(body.whopPlanId).trim() : null;
    if (v && !/^plan_[a-zA-Z0-9]+$/.test(v)) {
      throw new HttpError(400, "whopPlanId must match format 'plan_xxx'");
    }
    data.whopPlanId = v;
    changes.push({ field: "whopPlanId", oldValue: existing.whopPlanId, newValue: v });
  }
  if (body?.whopCheckoutUrl !== undefined) {
    const v = body.whopCheckoutUrl ? String(body.whopCheckoutUrl).trim() : null;
    if (v && !/^https:\/\/(www\.)?(whop\.com|whop\.checkout\.com)/i.test(v)) {
      throw new HttpError(400, "whopCheckoutUrl must be a https://whop.com URL");
    }
    data.whopCheckoutUrl = v;
    changes.push({ field: "whopCheckoutUrl", oldValue: existing.whopCheckoutUrl, newValue: v });
  }
  if (body?.billingPeriod !== undefined) {
    const v = body.billingPeriod ? String(body.billingPeriod).trim() : null;
    if (v && !ALLOWED_BILLING_PERIODS.includes(v)) {
      throw new HttpError(400, `billingPeriod must be one of: ${ALLOWED_BILLING_PERIODS.join(", ")}`);
    }
    data.billingPeriod = v;
    changes.push({ field: "billingPeriod", oldValue: existing.billingPeriod, newValue: v });
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, "No fields to update.");
  }

  data.updatedAt = new Date();

  // Update + log all changes in a transaction
  const updated = await db.$transaction(async (tx) => {
    const plan = await tx.pricingPlan.update({ where: { id }, data });
    for (const change of changes) {
      await tx.pricingPlanChange.create({
        data: {
          id: `chg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          planId: id,
          adminId,
          field: change.field,
          oldValue: change.oldValue === null || change.oldValue === undefined ? null : String(change.oldValue),
          newValue: change.newValue === null || change.newValue === undefined ? null : String(change.newValue),
        },
      });
    }
    return plan;
  });

  return NextResponse.json({ plan: updated, changesLogged: changes.length });
});

export const GET = apiRoute(async (_req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const plan = await db.pricingPlan.findUnique({ where: { id } });
  if (!plan) throw new HttpError(404, "Plan not found.");

  const history = await db.pricingPlanChange.findMany({
    where: { planId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ plan, history });
});
