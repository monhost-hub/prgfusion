/**
 * Whop API client (server-side only).
 *
 * Docs:
 *   - https://docs.whop.com/api-reference/introduction
 *   - https://docs.whop.com/api-reference/create-checkout-session
 *   - Webhooks: https://docs.whop.com/api-reference/webhooks
 *
 * SECURITY:
 *   - This module reads WHOP_COMPANY_API_KEY + WHOP_WEBHOOK_SECRET from env.
 *   - NEVER import this module from a client component.
 *   - NEVER expose the API key or webhook secret to the browser.
 *   - The webhook signature is verified with timing-safe comparison.
 */

const WHOP_API_BASE = "https://api.whop.com/api/v5";

/** Returns the Whop Company API key, or throws if missing. */
export function getWhopApiKey(): string {
  const k = process.env.WHOP_COMPANY_API_KEY;
  if (!k) throw new Error("WHOP_COMPANY_API_KEY is not configured");
  return k;
}

/** Returns the Whop webhook secret, or throws if missing. */
export function getWhopWebhookSecret(): string {
  const k = process.env.WHOP_WEBHOOK_SECRET;
  if (!k) throw new Error("WHOP_WEBHOOK_SECRET is not configured");
  return k;
}

/** Returns true if Whop is configured (without throwing). */
export function isWhopConfigured(): boolean {
  return Boolean(process.env.WHOP_COMPANY_API_KEY && process.env.WHOP_WEBHOOK_SECRET);
}

/**
 * Creates a Whop Checkout Session.
 *
 * Docs: POST /checkout/sessions
 * https://docs.whop.com/api-reference/create-checkout-session
 *
 * We pass `metadata.userId` so the webhook can later associate the payment
 * with the right AllCombiner user. The webhook NEVER trusts the client —
 * it only reads `metadata.userId` that we set here on the server side.
 */
export interface CreateCheckoutInput {
  /** Whop plan id, e.g. "plan_CfZL537w2pKOn" */
  planId: string;
  /** AllCombiner user id (stored in metadata, used by the webhook) */
  userId: string;
  /** Success redirect URL */
  successUrl?: string;
  /** Cancellation redirect URL */
  cancelUrl?: string;
}

export interface CreateCheckoutResult {
  /** The hosted checkout URL the user should be redirected to */
  checkoutUrl: string;
  /** Whop checkout session id (for audit) */
  sessionId: string;
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CreateCheckoutResult> {
  const apiKey = getWhopApiKey();
  const body: any = {
    plan_id: input.planId,
    metadata: {
      userId: input.userId,
      // Mark this checkout as coming from AllCombiner (for audit in Whop dashboard)
      source: "allcombiner",
    },
  };
  if (input.successUrl) body.success_url = input.successUrl;
  if (input.cancelUrl) body.cancel_url = input.cancelUrl;

  const res = await fetch(`${WHOP_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`Whop checkout create failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data: any = await res.json();
  // Whop returns the checkout URL in `checkout_url` (hosted) or we can extract it
  const checkoutUrl =
    data?.checkout_url ??
    data?.url ??
    data?.hosted_url ??
    (data?.id ? `https://whop.com/checkout/${data.id}` : null);

  if (!checkoutUrl) {
    throw new Error(`Whop response did not contain a checkout URL: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return {
    checkoutUrl,
    sessionId: data?.id ?? "",
  };
}

/**
 * Verifies the signature of a Whop webhook request.
 *
 * Whop signs webhooks with HMAC-SHA256 using the webhook secret.
 * The signature is sent in the `Whop-Signature` header.
 *
 * We use timing-safe comparison to prevent timing attacks.
 *
 * Returns true if the signature is valid.
 */
export function verifyWhopSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string = getWhopWebhookSecret()
): boolean {
  if (!signatureHeader) return false;

  // Whop signature header format: "t=<timestamp>,v1=<hex_signature>"
  // (similar to Stripe). We support both the Stripe-like format and a
  // raw signature fallback.
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
    // Stripe-like signed payload: HMAC(`${timestamp}.${rawBody}`)
    const signedPayload = `${timestamp}.${rawBody}`;
    expected = hmacSha256Hex(signedPayload, secret);
  } else {
    // Fallback: raw HMAC of the body
    expected = hmacSha256Hex(rawBody, secret);
    v1Signature = signatureHeader.trim();
  }

  if (!v1Signature) return false;

  // Timing-safe comparison
  return timingSafeEqual(expected, v1Signature);
}

/**
 * HMAC-SHA256 → hex string.
 * Uses Node's built-in crypto (no external dep).
 */
function hmacSha256Hex(data: string, secret: string): string {
  // Lazy require to avoid bundling crypto in client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require("node:crypto");
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

/**
 * Timing-safe string comparison.
 * Returns true if a === b (constant time).
 */
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

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
