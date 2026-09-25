import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWhopWebhook, isWhopConfigured, isTestPlan, getTestPlanCredits } from "@/lib/whop";
import { sendEmail } from "@/lib/email";
import { buildCreditPurchaseEmail, buildSubscriptionActivatedEmail } from "@/lib/email-templates";

/**
 * POST /api/webhooks/whop
 *
 * Whop webhook receiver. PUBLIC endpoint (no auth) but signed.
 *
 * Flow:
 *   1. Read raw body
 *   2. Verify Standard Webhooks signature using the official @whop/sdk helper
 *      (reads `webhook-id`, `webhook-timestamp`, `webhook-signature` headers,
 *       ±5 minute tolerance, base64 HMAC-SHA256)
 *      → if invalid, return 401 (don't process)
 *   3. The official helper returns the parsed payload directly
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
    console.warn(`[whop-webhook] Whop not configured, ignoring event`);
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // 2. Read raw body. NEVER use req.json() — signature covers the exact bytes.
  const rawBody = await req.text();

  // 3. Build a flat headers record for the @whop/sdk helper.
  //    The lookup inside `unwrapWebhook` is case-insensitive, so we just copy
  //    everything as-is.
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  // 4. Verify the Standard Webhooks signature (and parse the body in one call).
  const verification = verifyWhopWebhook(rawBody, headers);
  if (!verification.ok) {
    console.warn("[whop-webhook] signature rejected:", verification.reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 5. The payload is already parsed by `unwrapWebhook`. Keep using the same
  //    `event` variable name so the existing business logic below is unchanged.
  const event: any = verification.event;

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

  // 6. Determine event category
  //    CREDIT GRANT: only `payment.succeeded` triggers a credit grant.
  //    All other events (membership.activated, payment.completed, renewed, etc.)
  //    are logged for audit but do NOT credit the user.
  //    Failures and deactivations are also logged without crediting.
  const isPaymentSuccess = eventType === "payment.succeeded";
  const isPaymentFailure =
    eventType === "payment.failed" ||
    eventType === "payment.refunded" ||
    eventType === "payment.completed"; // intentionally treated as non-crediting
  const isDeactivation =
    eventType === "membership.deactivated" ||
    eventType === "membership.canceled" ||
    eventType === "subscription.canceled" ||
    eventType === "membership.activated" ||   // explicitly not crediting
    eventType === "membership.renewed" ||     // explicitly not crediting
    eventType === "subscription.renewed";     // explicitly not crediting

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
  //    PRODUCTION TEST: If whopPlanId is the prod test plan (plan_MheIAOiaGcRWe),
  //    use a hardcoded mapping (10 credits) — allows repeated $1 test payments.
  //    Each payment gets a unique whopPaymentId → idempotence at payment level
  //    still prevents double-credit for the SAME payment, but allows MULTIPLE
  //    different $1 payments to each grant 10 credits.
  let plan: any = null;
  let planCredits = 0;

  if (whopPlanId && isTestPlan(whopPlanId)) {
    // Production test plan ($1) — hardcoded mapping
    plan = {
      id: "test_plan",
      slug: "test_1dollar",
      credits: getTestPlanCredits(),
      priceMonthly: 1.0,
    };
    planCredits = plan.credits;
    console.log(`[whop-webhook] production test plan detected → ${planCredits} credits`);
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
      //    TEST PLAN + COMMERCIAL: insert with proper planId/planType
      let payment: any = null;
      if (whopPaymentId) {
        const isTest = isTestPlan(whopPlanId || "");
        try {
          payment = await tx.whopPayment.create({
            data: {
              id: `wpm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
              whopPaymentId,
              userId,
              planId: isTest ? null : plan.id,
              planType: isTest ? "test_1dollar" : "commercial",
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

    // === Send transactional email AFTER successful credit grant ===
    // Anti-doublon: this code only runs after the transaction succeeded.
    // If the same webhook is replayed, the transaction throws DUPLICATE_PAYMENT
    // or Unique constraint → caught below → returns "already processed" →
    // this code is never reached again.
    // Email failure is non-fatal: log error but don't fail the webhook.
    try {
      const locale = "fr"; // Default — could be enhanced with user locale preference
      const isTest = isTestPlan(whopPlanId || "");
      const isSubscription = plan.tier === "subscription" || plan.slug?.startsWith("sub_");

      if (isSubscription && !isTest) {
        // Subscription activated — send subscription email
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const content = buildSubscriptionActivatedEmail(locale, {
          userName: result.updatedUser.name || "",
          plan: plan.slug,
          credits: creditsToGrant,
          startDate,
          endDate,
          renewalPrice: plan.priceMonthly || 0,
          currency: currency || "EUR",
          autoRenew: true, // Whop subscriptions auto-renew by default
        });
        await sendEmail({
          to: result.updatedUser.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      } else if (!isTest) {
        // Credit purchase (recharge) — send credit purchase email
        const expiresAt = plan.expiresDays
          ? new Date(Date.now() + plan.expiresDays * 24 * 60 * 60 * 1000)
          : null;
        const content = buildCreditPurchaseEmail(locale, {
          userName: result.updatedUser.name || "",
          credits: creditsToGrant,
          amount: amount ?? plan.priceMonthly,
          currency: currency || "EUR",
          creditType: plan.tier || plan.slug || "recharge",
          expiresAt,
        });
        await sendEmail({
          to: result.updatedUser.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      }
      // Test plan ($1) — no email sent (internal testing only)
    } catch (emailErr) {
      // Log error but NEVER fail the webhook — credits are already granted
      console.error("[whop-webhook] Transactional email send failed:", emailErr instanceof Error ? emailErr.message : "unknown");
    }

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
