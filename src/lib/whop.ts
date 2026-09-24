/**
 * Whop API client (server-side only).
 *
 * Uses the official @whop/sdk for:
 *   - checkout session creation (WhopClient)
 *   - webhook signature verification (unwrapWebhook from @whop/sdk/helpers)
 *
 * Whop signs webhooks with the Standard Webhooks specification:
 *   - 3 headers: webhook-id, webhook-timestamp, webhook-signature
 *   - Payload signed = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   - HMAC-SHA256, base64-encoded
 *   - Header format: `v1,<base64>`
 *   - ±5 minute timestamp tolerance
 *
 * SECURITY:
 *   - This module reads API keys + webhook secrets from env.
 *   - NEVER import this module from a client component.
 *   - NEVER expose the API key or webhook secret to the browser.
 *   - Signature verification uses the official SDK (timing-safe under the hood).
 *
 * PRODUCTION ONLY:
 *   - The sandbox/test mode has been removed. All operations use the real
 *     Whop API (https://api.whop.com) with WHOP_COMPANY_API_KEY and
 *     WHOP_WEBHOOK_SECRET.
 */

import { WhopClient } from "@whop/sdk";
import {
  unwrapWebhook,
  WebhookVerificationError,
} from "@whop/sdk/helpers";

/**
 * Production test plan ($1 one-time).
 * Used for real production payment testing — NOT a commercial plan.
 * Each successful payment grants 10 test credits.
 * (10 instead of 1 makes the credit grant visible in the UI during testing.)
 */
const TEST_PLAN_ID = "plan_MheIAOiaGcRWe";
const TEST_PLAN_CREDITS = 10;

/** Returns true if a whopPlanId is the production test plan. */
export function isTestPlan(whopPlanId: string): boolean {
  return whopPlanId === TEST_PLAN_ID;
}

/** Returns the test plan credits (10). */
export function getTestPlanCredits(): number {
  return TEST_PLAN_CREDITS;
}

/** Returns the Whop API key (production), or throws if missing. */
export function getWhopApiKey(): string {
  const k = process.env.WHOP_COMPANY_API_KEY;
  if (!k) throw new Error("WHOP_COMPANY_API_KEY is not configured");
  return k;
}

/** Returns the Whop webhook secret (production), or throws if missing. */
export function getWhopWebhookSecret(): string {
  const k = process.env.WHOP_WEBHOOK_SECRET;
  if (!k) throw new Error("WHOP_WEBHOOK_SECRET is not configured");
  return k;
}

/** Returns true if Whop is configured (without throwing). */
export function isWhopConfigured(): boolean {
  return Boolean(
    process.env.WHOP_COMPANY_API_KEY && process.env.WHOP_WEBHOOK_SECRET
  );
}

export interface CreateCheckoutInput {
  /** Whop plan id, e.g. "plan_CfZL537w2pKOn" */
  planId: string;
  /** AllCombiner user id (stored in metadata, used by the webhook) */
  userId: string;
  /** Success redirect URL (maps to redirect_url in Whop SDK) */
  successUrl?: string;
  /** Cancellation redirect URL (not directly supported — ignored) */
  cancelUrl?: string;
}

export interface CreateCheckoutResult {
  /** The hosted checkout URL the user should be redirected to */
  checkoutUrl: string;
  /** Whop checkout configuration id (for audit) */
  sessionId: string;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  const apiKey = getWhopApiKey();

  const client = new WhopClient({
    token: apiKey,
  });

  const response = await client.checkoutConfigurations.create({
    plan_id: input.planId,
    metadata: {
      userId: input.userId,
      source: "allcombiner",
    },
    ...(input.successUrl ? { redirect_url: input.successUrl } : {}),
  });

  const checkoutUrl = response.purchase_url;

  if (!checkoutUrl) {
    throw new Error(
      `Whop checkout configuration did not return a purchase_url: ${JSON.stringify(response).slice(0, 300)}`
    );
  }

  return {
    checkoutUrl,
    sessionId: response.id ?? "",
  };
}

/**
 * Result of a Whop webhook verification.
 *
 * - `ok: true`  → signature valid, `event` contains the parsed payload.
 * - `ok: false` → signature invalid / missing headers / timestamp out of tolerance,
 *   `reason` explains the failure (safe to log; never contains the secret).
 */
export type VerifyWhopWebhookResult =
  | { ok: true; event: Record<string, unknown> }
  | { ok: false; reason: string };

/**
 * Verifies a Whop webhook request using the official @whop/sdk helper.
 *
 * Whop signs webhooks with the Standard Webhooks spec. The official
 * `unwrapWebhook` helper handles:
 *   - reading `webhook-id`, `webhook-timestamp`, `webhook-signature` headers
 *     (case-insensitive)
 *   - ±5 minute timestamp tolerance (rejects replay attacks)
 *   - HMAC-SHA256 + base64 comparison (timing-safe under the hood)
 *   - the `ws_` prefix on the secret
 *
 * @param rawBody    The raw request body (from `await req.text()`).
 *                   Re-serializing the body would break the signature.
 * @param headers    The request headers as a flat Record<string, string>.
 *                   Build it from `req.headers` (see the webhook route).
 * @param secret     The Whop webhook secret (with `ws_` prefix), defaults to
 *                   WHOP_WEBHOOK_SECRET. Pass explicitly only for tests.
 */
export function verifyWhopWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string = getWhopWebhookSecret()
): VerifyWhopWebhookResult {
  try {
    const event = unwrapWebhook<Record<string, unknown>>(rawBody, {
      headers,
      key: secret,
    });
    return { ok: true, event: event ?? {} };
  } catch (err: unknown) {
    if (err instanceof WebhookVerificationError) {
      return { ok: false, reason: err.message };
    }
    // unwrapWebhook throws a plain Error if `key` is missing/empty, and
    // standardwebhooks can throw on JSON parse failure of the body.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg };
  }
}
