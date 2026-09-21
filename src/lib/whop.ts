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
 * SANDBOX:
 *   - Set WHOP_SANDBOX=true to switch to sandbox mode.
 *   - Sandbox uses WHOP_SANDBOX_API_KEY + WHOP_SANDBOX_WEBHOOK_SECRET.
 *   - Sandbox API base: https://sandbox-api.whop.com/api/v1
 *   - Sandbox plan ID: plan_qQ58RuDGa0lKf → 30 credits (test mapping)
 *   - Production variables (WHOP_COMPANY_API_KEY, WHOP_WEBHOOK_SECRET) are
 *     never modified or read in sandbox mode.
 */

import { WhopClient } from "@whop/sdk";

const SANDBOX_API_BASE = "https://sandbox-api.whop.com/api/v1";

/**
 * Sandbox test plan mapping.
 * In sandbox mode, ALL checkouts use this plan ID regardless of the plan
 * selected by the user. The webhook credits 30 credits for this plan.
 * This avoids needing a DB entry for the sandbox plan.
 */
const SANDBOX_PLAN_ID = "plan_qQ58RuDGa0lKf";
const SANDBOX_PLAN_CREDITS = 30;

/** Returns true if sandbox mode is enabled. */
export function isSandbox(): boolean {
  return process.env.WHOP_SANDBOX === "true";
}

/** Returns the Whop API key (sandbox or production), or throws if missing. */
export function getWhopApiKey(): string {
  if (isSandbox()) {
    const k = process.env.WHOP_SANDBOX_API_KEY;
    if (!k) throw new Error("WHOP_SANDBOX_API_KEY is not configured");
    return k;
  }
  const k = process.env.WHOP_COMPANY_API_KEY;
  if (!k) throw new Error("WHOP_COMPANY_API_KEY is not configured");
  return k;
}

/** Returns the Whop webhook secret (sandbox or production), or throws if missing. */
export function getWhopWebhookSecret(): string {
  if (isSandbox()) {
    const k = process.env.WHOP_SANDBOX_WEBHOOK_SECRET;
    if (!k) throw new Error("WHOP_SANDBOX_WEBHOOK_SECRET is not configured");
    return k;
  }
  const k = process.env.WHOP_WEBHOOK_SECRET;
  if (!k) throw new Error("WHOP_WEBHOOK_SECRET is not configured");
  return k;
}

/** Returns true if Whop is configured (without throwing). */
export function isWhopConfigured(): boolean {
  if (isSandbox()) {
    return Boolean(
      process.env.WHOP_SANDBOX_API_KEY && process.env.WHOP_SANDBOX_WEBHOOK_SECRET
    );
  }
  return Boolean(
    process.env.WHOP_COMPANY_API_KEY && process.env.WHOP_WEBHOOK_SECRET
  );
}

/**
 * In sandbox mode, returns the test plan ID (plan_qQ58RuDGa0lKf).
 * In production, returns the plan ID from the DB.
 */
export function getSandboxPlanId(): string {
  return SANDBOX_PLAN_ID;
}

/**
 * In sandbox mode, returns the test plan credits (30).
 * In production, this is not used (credits come from the DB).
 */
export function getSandboxPlanCredits(): number {
  return SANDBOX_PLAN_CREDITS;
}

/**
 * Checks if a given whopPlanId is the sandbox test plan.
 */
export function isSandboxPlan(whopPlanId: string): boolean {
  return isSandbox() && whopPlanId === SANDBOX_PLAN_ID;
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
  const sandbox = isSandbox();

  // In sandbox mode, always use the test plan ID
  const effectivePlanId = sandbox ? SANDBOX_PLAN_ID : input.planId;

  const client = new WhopClient({
    token: apiKey,
    // Override base URL in sandbox mode
    ...(sandbox ? { baseUrl: SANDBOX_API_BASE } : {}),
  });

  const response = await client.checkoutConfigurations.create({
    plan_id: effectivePlanId,
    metadata: {
      userId: input.userId,
      source: "allcombiner",
      ...(sandbox ? { sandbox: "true" } : {}),
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
 * Uses the sandbox or production webhook secret depending on WHOP_SANDBOX.
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
