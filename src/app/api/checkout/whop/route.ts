import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAuth, HttpError } from "@/lib/server";
import { db } from "@/lib/db";
import { createCheckoutSession, isWhopConfigured } from "@/lib/whop";

/**
 * POST /api/checkout/whop
 *
 * Body: { planSlug: string }
 *
 * Flow:
 *   1. Auth required — user must be logged in
 *   2. Look up the plan by slug in DB (server-side)
 *   3. Validate the plan has a whopPlanId (else 400)
 *   4. Create a Whop Checkout Session with metadata.userId = current user id
 *   5. Return the checkout URL to redirect the browser to
 *
 * SECURITY:
 *   - The user NEVER sends a price, credits, or planId to this endpoint.
 *   - The server reads everything from the DB based on the slug.
 *   - The userId passed to Whop is taken from the session, never from the body.
 *   - WHOP_COMPANY_API_KEY is never exposed to the browser.
 *
 * NOTE: This endpoint only creates the checkout session. The actual credit
 * grant happens LATER, when the Whop webhook fires (see /api/webhooks/whop).
 * We NEVER grant credits here, even if the user comes back from a "success"
 * URL — only the webhook can grant credits, after signature verification.
 */
export const POST = apiRoute(async (req: NextRequest) => {
  // 1. Auth
  const session = await requireAuth();
  const userId = session.user!.id!;

  // 1b. Email verification gate — block checkout if email is not verified.
  //     This prevents payments from being attributed to unverified accounts.
  //     The webhook still processes any valid payment that slips through
  //     (e.g. user verifies email after checkout but before webhook arrives).
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  }).catch(() => null);

  if (!user || !user.emailVerified) {
    throw new HttpError(403, JSON.stringify({ code: "EMAIL_NOT_VERIFIED" }));
  }

  // 2. Check Whop is configured
  if (!isWhopConfigured()) {
    throw new HttpError(503, `Payment system is not configured. Please contact support.`);
  }

  // 3. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  const planSlug = String(body?.planSlug || "").trim();
  if (!planSlug) {
    throw new HttpError(400, "planSlug is required.");
  }

  // 4. Look up the plan: either from DB (commercial) or hardcoded (test plan)
  //    The test plan slug "test_1dollar" is NOT in the DB — it's a hardcoded
  //    test plan that uses plan_MheIAOiaGcRWe on Whop.
  let plan: any = null;
  if (planSlug === "test_1dollar") {
    plan = {
      id: "test_plan",
      slug: "test_1dollar",
      whopPlanId: "plan_MheIAOiaGcRWe",
      enabled: true,
      nameJson: JSON.stringify({ en: "Test $1", fr: "Test 1$", es: "Test 1$" }),
    };
  } else {
    plan = await db.pricingPlan.findUnique({ where: { slug: planSlug } }).catch(() => null);
  }
  if (!plan) {
    throw new HttpError(404, "Plan not found.");
  }
  if (!plan.enabled) {
    throw new HttpError(400, "This plan is not available.");
  }
  if (!plan.whopPlanId) {
    throw new HttpError(400, "This plan does not support online payment yet.");
  }

  // 5. Build success/cancel URLs.
  //    BOTH point to /dashboard because the CheckoutStatus box component
  //    (which handles ?checkout=success|cancelled|error) only lives on
  //    /dashboard. Pointing cancelUrl to /dashboard?checkout=cancelled
  //    ensures the user sees the "Paiement annulé" box after cancelling.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://allcombiner.com";
  const successUrl = `${appUrl}/dashboard?checkout=success`;
  const cancelUrl = `${appUrl}/dashboard?checkout=cancelled`;

  // 6. Create the Whop checkout session (server-side only)
  let checkout;
  try {
    checkout = await createCheckoutSession({
      planId: plan.whopPlanId,
      userId, // ← passed to Whop as metadata.userId, used by the webhook
      successUrl,
      cancelUrl,
    });
  } catch (err: any) {
    console.error("[checkout] Whop session creation failed:", err.message);
    throw new HttpError(502, "Could not create payment session. Please try again.");
  }

  // 7. Return the checkout URL — the browser will redirect to it.
  //    We do NOT grant credits here. Only the webhook can.
  return NextResponse.json({
    checkoutUrl: checkout.checkoutUrl,
    sessionId: checkout.sessionId,
    planSlug: plan.slug,
    planName: plan.nameJson,
  });
});
