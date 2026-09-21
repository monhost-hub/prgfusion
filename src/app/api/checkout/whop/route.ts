import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAuth, HttpError } from "@/lib/server";
import { db } from "@/lib/db";
import { createCheckoutSession, isWhopConfigured, isSandbox } from "@/lib/whop";

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

  // 2. Check Whop is configured
  if (!isWhopConfigured()) {
    throw new HttpError(503, `Payment system is not configured (${isSandbox() ? "sandbox" : "production"} mode). Please contact support.`);
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

  // 4. Look up the plan in DB (server-side — never trust client for price/credits)
  const plan = await db.pricingPlan.findUnique({ where: { slug: planSlug } }).catch(() => null);
  if (!plan) {
    throw new HttpError(404, "Plan not found.");
  }
  if (!plan.enabled) {
    throw new HttpError(400, "This plan is not available.");
  }
  if (!plan.whopPlanId) {
    throw new HttpError(400, "This plan does not support online payment yet.");
  }

  // 5. Build success/cancel URLs
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://allcombiner.com";
  const successUrl = `${appUrl}/dashboard?checkout=success`;
  const cancelUrl = `${appUrl}/pricing?checkout=cancelled`;

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
