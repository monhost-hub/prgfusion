/**
 * Whop API client (server-side only).
 *
 * Uses the official @whop/sdk for checkout session creation.
 * Webhook signature verification is done manually (see verifyWhopSignature below)
 * because the SDK's webhooks.unwrap is not yet stable.
 *
 * SECURITY:
 *   - This module reads API keys + webhook secrets from env.
 *   - NEVER import this module from a client component.
 *   - NEVER expose the API key or webhook secret to the browser.
 *   - The webhook signature is verified with timing-safe comparison.
 *
 * PRODUCTION ONLY:
 *   - The sandbox/test mode has been removed. All operations use the real
 *     Whop API (https://api.whop.com) with WHOP_COMPANY_API_KEY and
 *     WHOP_WEBHOOK_SECRET.
 */

import { WhopClient } from "@whop/sdk";

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
 * Verifies the signature of a Whop webhook request.
 * Uses the production webhook secret (WHOP_WEBHOOK_SECRET).
 */
export function verifyWhopSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string = getWhopWebhookSecret()
): boolean {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",");
  let timestamp = "";
  let v1Signature = "";
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "t") timestamp = v;
    else if (k === "v1") v1Signature = v;
  }

  let expected: string;
  if (timestamp && v1Signature) {
    const signedPayload = `${timestamp}.${rawBody}`;
    expected = hmacSha256Hex(signedPayload, secret);
  } else {
    expected = hmacSha256Hex(rawBody, secret);
    v1Signature = signatureHeader.trim();
  }

  if (!v1Signature) return false;

  return timingSafeEqual(expected, v1Signature);
}

function hmacSha256Hex(data: string, secret: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("node:crypto");
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { timingSafeEqual: tse } = require("node:crypto");
  if (a.length !== b.length) return false;
  try {
    return tse(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}
