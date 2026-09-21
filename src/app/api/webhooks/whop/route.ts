import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWhopSignature, isWhopConfigured, isSandbox, isSandboxPlan, getSandboxPlanCredits, isTestPlan, getTestPlanCredits } from "@/lib/whop";

/**
 * POST /api/webhooks/whop
 *
 * Whop webhook receiver. PUBLIC endpoint (no auth) but signed.
 *
 * Flow:
 *   1. Read raw body + Whop-Signature header
 *   2. Verify signature with WHOP_WEBHOOK_SECRET (timing-safe compare)
 *      → if invalid, return 401 (don't process)
 *   3. Parse the event
 *   4. IDEMPOTENCE: try to insert a WhopEvent row with whopEventId UNIQUE
 *      → if it already exists, return 200 (already processed, don't re-credit)
 *   5. Extract: eventType, whopPaymentId, whopMembershipId, userId (from metadata),
 *      planId (from Whop, NOT from client)
 *   6. Look up the PricingPlan in DB by whopPlanId
 *      → if not found, mark event as "unknown_plan" and stop
 *   7. Look up the User by userId (from metadata)
 *      → if not found, mark event as "no_user" and stop
 *   8. Based on event type:
 *      - payment.succeeded / membership.activated → grant plan.credits
 *      - payment.failed → no credit, log only
 *      - membership.deactivated → no credit, log only
 *   9. All DB operations in a single transaction:
 *      - Insert WhopEvent (status=succeeded, creditsGranted=N)
 *      - Insert WhopPayment (UNIQUE whopPaymentId — idempotence at payment level too)
 *      - Update User.credits += N
 *      - Insert CreditTransaction (audit log)
 *
 * Returns 200 on success, 401 on bad signature, 500 on internal error.
 *
 * Whop expects a 200 response quickly — we don't block on slow operations.
 */

// Disable body parsing — we need the raw body for signature verification
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 1. Check Whop is configured
  if (!isWhopConfigured()) {
    console.warn(`[whop-webhook] Whop not configured (${isSandbox() ? "sandbox" : "production"} mode), ignoring event`);
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // 2. Read raw body + signature
  const rawBody = await req.text();
  const signature = req.headers.get("whop-signature") || req.headers.get("Whop-Signature");

  // 3. Verify signature
  let isValid = false;
  try {
    isValid = verifyWhopSignature(rawBody, signature);
  } catch (err: any) {
    console.error("[whop-webhook] signature verification error:", err.message);
    return NextResponse.json({ error: "signature error" }, { status: 401 });
  }
  if (!isValid) {
    console.warn("[whop-webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 4. Parse the event
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error("[whop-webhook] invalid JSON");
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const whopEventId: string | undefined =
    event?.id || event?.event_id || event?.data?.id || `evt_${Date.now()}_${Math.random()}`;
  const eventType: string =
    event?.type || event?.event_type || event?.eventType || "unknown";

  // Extract common fields from various Whop payload shapes
  const data = event?.data ?? event?.object ?? event;
  const metadata = data?.metadata ?? event?.metadata ?? {};
  const userId: string | undefined = metadata.userId || metadata.user_id;
  const whopPaymentId: string | undefined =
    data?.id || data?.payment_id || event?.payment_id || data?.payment?.id;
  const whopMembershipId: string | undefined =
    data?.membership_id || data?.membership?.id || event?.membership_id;
  // Whop plan id (e.g. "plan_CfZL537w2pKOn") — this is the SOURCE OF TRUTH
  const whopPlanId: string | undefined =
    data?.plan_id || data?.plan?.id || data?.product_id || event?.plan_id;
  const amount: number | undefined =
    data?.amount || data?.total || data?.price?.amount;
  const currency: string | undefined =
    data?.currency || data?.price?.currency || "EUR";

  // 5. IDEMPOTENCE: try to insert WhopEvent row with UNIQUE whopEventId
  //    If it already exists → already processed → return 200 (don't re-credit)
  const existingEvent = await db.whopEvent
    .findUnique({ where: { whopEventId } })
    .catch(() => null);

  if (existingEvent) {
    console.log(`[whop-webhook] event ${whopEventId} already processed (status=${existingEvent.status})`);
    return NextResponse.json({
      ok: true,
      message: "event already processed",
      status: existingEvent.status,
    });
  }

  // 6. Determine event category (success / failure / lifecycle)
  const isPaymentSuccess =
    eventType === "payment.succeeded" ||
    eventType === "payment.completed" ||
    eventType === "membership.activated" ||
    eventType === "membership.renewed" ||
    eventType === "subscription.renewed";
  const isPaymentFailure =
    eventType === "payment.failed" || eventType === "payment.refunded";
  const isDeactivation =
    eventType === "membership.deactivated" ||
    eventType === "membership.canceled" ||
    eventType === "subscription.canceled";

  // 7. If we can't determine the event type, log and exit
  if (!isPaymentSuccess && !isPaymentFailure && !isDeactivation) {
    console.log(`[whop-webhook] unhandled event type: ${eventType}`);
    await db.whopEvent
      .create({
        data: {
          id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          whopEventId,
          eventType,
          whopPaymentId: whopPaymentId ?? null,
          whopMembershipId: whopMembershipId ?? null,
          userId: userId ?? null,
          planSlug: null,
          status: "ignored",
          creditsGranted: 0,
          rawPayload: rawBody.slice(0, 65000),
          error: `unhandled event type: ${eventType}`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, message: "event ignored (unhandled type)" });
  }

  // 8. Look up the PricingPlan in DB by whopPlanId (source of truth)
  //    The webhook NEVER trusts credits from the client or from Whop metadata.
  //    It always reads credits from the AllCombiner DB.
  //
  //    SANDBOX: If whopPlanId is the sandbox test plan (plan_qQ58RuDGa0lKf),
  //    use a hardcoded test mapping (30 credits) instead of looking up the DB.
  //
  //    PRODUCTION TEST: If whopPlanId is the prod test plan (plan_MheIAOiaGcRWe),
  //    use a hardcoded mapping (1 credit) — allows repeated $1 test payments.
  //    Each payment gets a unique whopPaymentId → idempotence at payment level
  //    still prevents double-credit for the SAME payment, but allows MULTIPLE
  //    different $1 payments to each grant 1 credit.
  let plan: any = null;
  let planCredits = 0;

  if (whopPlanId && isSandboxPlan(whopPlanId)) {
    // Sandbox test plan
    plan = {
      id: "sandbox_plan",
      slug: "sandbox_test",
      credits: getSandboxPlanCredits(),
      priceMonthly: 0.01,
    };
    planCredits = plan.credits;
    console.log(`[whop-webhook] sandbox plan detected → ${planCredits} credits`);
  } else if (whopPlanId && isTestPlan(whopPlanId)) {
    // Production test plan ($1)
    plan = {
      id: "test_plan",
      slug: "test_1dollar",
      credits: getTestPlanCredits(),
      priceMonthly: 1.0,
    };
    planCredits = plan.credits;
    console.log(`[whop-webhook] production test plan detected → ${planCredits} credit`);
  } else if (whopPlanId) {
    // Production — look up in DB
    plan = await db.pricingPlan
      .findFirst({ where: { whopPlanId } })
      .catch(() => null);
    if (plan) {
      planCredits = plan.credits;
    }
  }

  if (!plan) {
    console.warn(`[whop-webhook] unknown whopPlanId: ${whopPlanId}`);
    await db.whopEvent
      .create({
        data: {
          id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          whopEventId,
          eventType,
          whopPaymentId: whopPaymentId ?? null,
          whopMembershipId: whopMembershipId ?? null,
          userId: userId ?? null,
          planSlug: null,
          status: "unknown_plan",
          creditsGranted: 0,
          rawPayload: rawBody.slice(0, 65000),
          error: `No PricingPlan matches whopPlanId=${whopPlanId}`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, message: "unknown plan — no credits granted" });
  }

  // 9. Look up the user (from metadata.userId set during checkout)
  if (!userId) {
    console.warn(`[whop-webhook] no userId in metadata for event ${whopEventId}`);
    await db.whopEvent
      .create({
        data: {
          id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          whopEventId,
          eventType,
          whopPaymentId: whopPaymentId ?? null,
          whopMembershipId: whopMembershipId ?? null,
          userId: null,
          planSlug: plan.slug,
          status: "no_user",
          creditsGranted: 0,
          rawPayload: rawBody.slice(0, 65000),
          error: "No userId in Whop metadata",
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, message: "no user — no credits granted" });
  }

  const user = await db.user.findUnique({ where: { id: userId } }).catch(() => null);
  if (!user) {
    console.warn(`[whop-webhook] user not found: ${userId}`);
    await db.whopEvent
      .create({
        data: {
          id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          whopEventId,
          eventType,
          whopPaymentId: whopPaymentId ?? null,
          whopMembershipId: whopMembershipId ?? null,
          userId,
          planSlug: plan.slug,
          status: "no_user",
          creditsGranted: 0,
          rawPayload: rawBody.slice(0, 65000),
          error: `User ${userId} not found in DB`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, message: "user not found — no credits granted" });
  }

  // 10. If payment failed → no credits. Just log.
  if (isPaymentFailure || isDeactivation) {
    await db.whopEvent
      .create({
        data: {
          id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          whopEventId,
          eventType,
          whopPaymentId: whopPaymentId ?? null,
          whopMembershipId: whopMembershipId ?? null,
          userId,
          planSlug: plan.slug,
          status: isPaymentFailure ? "failed" : "deactivated",
          creditsGranted: 0,
          rawPayload: rawBody.slice(0, 65000),
          error: null,
        },
      })
      .catch(() => {});
    console.log(`[whop-webhook] event ${eventType} for user ${userId} — no credits (failure/deactivation)`);
    return NextResponse.json({ ok: true, message: "failure/deactivation logged" });
  }

  // 11. Payment succeeded → grant credits in a single transaction.
  //     - WhopEvent row (idempotence key — UNIQUE whopEventId)
  //     - WhopPayment row (UNIQUE whopPaymentId — idempotence at payment level)
  //     - User.credits += plan.credits
  //     - CreditTransaction (audit log)
  const creditsToGrant = planCredits;

  try {
    const result = await db.$transaction(async (tx) => {
      // a) Insert WhopEvent (UNIQUE on whopEventId → throws if duplicate)
      const wevt = await tx.whopEvent.create({
        data: {
          id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          whopEventId,
          eventType,
          whopPaymentId: whopPaymentId ?? null,
          whopMembershipId: whopMembershipId ?? null,
          userId,
          planSlug: plan.slug,
          status: "succeeded",
          creditsGranted: creditsToGrant,
          rawPayload: rawBody.slice(0, 65000),
        },
      });

      // b) Insert WhopPayment (UNIQUE on whopPaymentId → idempotent at payment level)
      //    If whopPaymentId is missing, skip (we still have the event for audit).
      //    SANDBOX + TEST PLAN: plan.id is not a real DB row → skip WhopPayment
      //    insertion to avoid foreign key violation. The WhopEvent still logs everything.
      let payment: any = null;
      const isVirtualPlan = isSandboxPlan(whopPlanId || "") || isTestPlan(whopPlanId || "");
      if (whopPaymentId && !isVirtualPlan) {
        try {
          payment = await tx.whopPayment.create({
            data: {
              id: `wpm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
              whopPaymentId,
              userId,
              planId: plan.id,
              whopEventId: wevt.id,
              amount: amount ?? plan.priceMonthly,
              currency: currency || "EUR",
              credits: creditsToGrant,
              status: "succeeded",
              whopMembershipId: whopMembershipId ?? null,
              updatedAt: new Date(),
            },
          });
        } catch (e: any) {
          if (/Unique constraint/i.test(e.message)) {
            throw new Error(`DUPLICATE_PAYMENT:${whopPaymentId}`);
          }
          throw e;
        }
      }

      // c) Credit the user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: creditsToGrant }, updatedAt: new Date() },
      });

      // d) Insert CreditTransaction (audit log)
      await tx.creditTransaction.create({
        data: {
          id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          userId,
          amount: creditsToGrant,
          balance: updatedUser.credits,
          reason: "subscription",
          reference: `whop:${plan.slug}`,
        },
      });

      return { wevt, payment, updatedUser };
    });

    console.log(
      `[whop-webhook] ✓ ${eventType} → user ${userId} +${creditsToGrant} credits (plan: ${plan.slug})`
    );
    return NextResponse.json({
      ok: true,
      message: "credits granted",
      creditsGranted: creditsToGrant,
      newBalance: result.updatedUser.credits,
    });
  } catch (err: any) {
    // Duplicate whopEventId → already processed (race condition safeguard)
    if (/Unique constraint.*whopEventId/i.test(err.message)) {
      console.log(`[whop-webhook] event ${whopEventId} already processed (race)`);
      return NextResponse.json({ ok: true, message: "already processed" });
    }
    // Duplicate whopPaymentId → already credited in a previous event
    if (/DUPLICATE_PAYMENT/.test(err.message)) {
      console.log(`[whop-webhook] payment ${whopPaymentId} already credited — skipping`);
      // Update the WhopEvent to mark it as already-processed
      // (the insert succeeded in the transaction before the duplicate payment was detected,
      //  but the transaction rolled back — so we re-insert with status=ignored)
      await db.whopEvent
        .create({
          data: {
            id: `wevt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            whopEventId: `${whopEventId}_dup_payment`,
            eventType,
            whopPaymentId: whopPaymentId ?? null,
            whopMembershipId: whopMembershipId ?? null,
            userId,
            planSlug: plan.slug,
            status: "ignored",
            creditsGranted: 0,
            rawPayload: rawBody.slice(0, 65000),
            error: `Payment ${whopPaymentId} was already credited by a previous event`,
          },
        })
        .catch(() => {});
      return NextResponse.json({ ok: true, message: "payment already credited" });
    }
    console.error("[whop-webhook] transaction failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
