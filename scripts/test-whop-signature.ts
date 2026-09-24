/**
 * Standard Webhooks signature tests for the Whop webhook receiver.
 *
 * Run: `bun run scripts/test-whop-signature.ts`
 *
 * These tests verify ONLY the signature verification layer — they do not
 * exercise the DB transaction logic (which is already covered by the
 * integration tests in `test-whop.ts`).
 *
 * Unlike the legacy tests, these use the REAL Standard Webhooks format that
 * Whop actually sends on every webhook delivery:
 *
 *   headers:
 *     webhook-id:          msg_<random>
 *     webhook-timestamp:   <unix seconds, must be within ±5 min of now>
 *     webhook-signature:   v1,<base64(hmac-sha256(`${id}.${ts}.${body}`, secret))>
 *
 * The secret is the Whop webhook secret INCLUDING the `ws_` prefix.
 *
 * Reference: @whop/sdk/dist/cjs/helpers/verifyWebhook.js
 *            node_modules/standardwebhooks/dist/index.js
 */

import { createHmac, randomBytes } from "node:crypto";

// We need to set the env var BEFORE importing the module under test,
// because `getWhopWebhookSecret()` reads it at call time (lazy), so we can
// also import normally — but doing it explicitly keeps the test hermetic.
const TEST_SECRET = "ws_" + randomBytes(24).toString("hex");
process.env.WHOP_WEBHOOK_SECRET = TEST_SECRET;
process.env.WHOP_COMPANY_API_KEY = "test_key_for_signature_tests_only";

// Dynamic import so env is set first.
const { verifyWhopWebhook } = await import("../src/lib/whop");

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

/**
 * Build a VALID Standard Webhooks signature for a given payload, exactly
 * the way the real Whop backend would.
 *
 *  1. msg_id   = `msg_<random>`
 *  2. timestamp = current unix seconds
 *  3. to_sign   = `${msg_id}.${timestamp}.${rawBody}`  (UTF-8 bytes)
 *  4. sig       = base64(HMAC-SHA256(to_sign, secret))  ← NOT hex
 *  5. header    = `v1,${sig}`
 *
 * The `@whop/sdk` helper base64-encodes the secret internally before
 * passing it to `standardwebhooks`, which base64-decodes it. The net
 * effect is that the HMAC key is the raw bytes of the secret string
 * (prefix `ws_` included) — so we sign with the raw secret here.
 */
function signLikeWhop(rawBody: string, secret: string = TEST_SECRET, opts?: { ts?: number; msgId?: string }) {
  const msgId = opts?.msgId ?? "msg_" + randomBytes(12).toString("hex");
  const timestamp = (opts?.ts ?? Math.floor(Date.now() / 1000)).toString();
  const toSign = `${msgId}.${timestamp}.${rawBody}`;
  const sig = createHmac("sha256", secret).update(toSign, "utf8").digest("base64");
  return {
    msgId,
    timestamp,
    headers: {
      "webhook-id": msgId,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${sig}`,
    },
  };
}

async function main() {
  console.log("\n=== Whop Webhook Signature Tests (Standard Webhooks) ===\n");
  console.log(`Using test secret (NOT a real secret): ${TEST_SECRET.slice(0, 8)}…\n`);

  // === TEST 1: A real Whop-shaped payload is accepted ===
  console.log("TEST 1: Valid Standard Webhooks signature → accepted");
  {
    const payload = {
      id: "evt_test1_" + Date.now(),
      type: "payment.succeeded",
      data: {
        id: "pay_test1_" + Date.now(),
        metadata: { userId: "user_abc" },
        plan_id: "plan_MheIAOiaGcRWe", // test $1 plan
        amount: 100,
        currency: "usd",
      },
    };
    const rawBody = JSON.stringify(payload);
    const { headers } = signLikeWhop(rawBody);

    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === true, "signature accepted (ok=true)");
    assert(result.ok && (result.event as any).type === "payment.succeeded", "payload parsed and event.type matches");
    assert(result.ok && (result.event as any).data.plan_id === "plan_MheIAOiaGcRWe", "plan_id correctly extracted from parsed payload");
  }

  // === TEST 2: Whop sends MULTIPLE signatures in webhook-signature (space-separated) ===
  // standardwebhooks splits on space and tries each one. Real Whop can send
  // e.g. "v1,<old> v1,<new>" during key rotation.
  console.log("\nTEST 2: Multiple v1 signatures (key rotation) → accepted if any matches");
  {
    const payload = { id: "evt_test2", type: "payment.succeeded", data: { id: "pay_2", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const msgId = "msg_" + randomBytes(12).toString("hex");
    const ts = Math.floor(Date.now() / 1000).toString();

    // Sign with a WRONG secret, then with the RIGHT secret.
    const wrongSig = createHmac("sha256", "ws_wrong_secret")
      .update(`${msgId}.${ts}.${rawBody}`, "utf8")
      .digest("base64");
    const rightSig = createHmac("sha256", TEST_SECRET)
      .update(`${msgId}.${ts}.${rawBody}`, "utf8")
      .digest("base64");

    const headers = {
      "webhook-id": msgId,
      "webhook-timestamp": ts,
      "webhook-signature": `v1,${wrongSig} v1,${rightSig}`,
    };

    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === true, "accepted when at least one signature matches");
  }

  // === TEST 3: Wrong secret → rejected ===
  console.log("\nTEST 3: Signature from wrong secret → rejected");
  {
    const payload = { id: "evt_test3", type: "payment.succeeded", data: { id: "pay_3", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const { headers } = signLikeWhop(rawBody, "ws_wrong_secret");
    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === false, "rejected (ok=false)");
    assert(!result.ok && result.reason.length > 0, "rejection reason provided");
  }

  // === TEST 4: Missing webhook-signature header → rejected ===
  console.log("\nTEST 4: Missing webhook-signature header → rejected");
  {
    const payload = { id: "evt_test4", type: "payment.succeeded", data: { id: "pay_4", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const { msgId, timestamp } = signLikeWhop(rawBody);
    const headers = {
      "webhook-id": msgId,
      "webhook-timestamp": timestamp,
      // webhook-signature intentionally omitted
    };
    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === false, "rejected (ok=false)");
  }

  // === TEST 5: Missing webhook-id header → rejected ===
  console.log("\nTEST 5: Missing webhook-id header → rejected");
  {
    const payload = { id: "evt_test5", type: "payment.succeeded", data: { id: "pay_5", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const { timestamp, headers: fullHeaders } = signLikeWhop(rawBody);
    const headers = {
      "webhook-timestamp": timestamp,
      "webhook-signature": fullHeaders["webhook-signature"],
    };
    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === false, "rejected (ok=false)");
  }

  // === TEST 6: Timestamp out of tolerance (>5 min old) → rejected ===
  console.log("\nTEST 6: Timestamp >5 min old → rejected (replay protection)");
  {
    const payload = { id: "evt_test6", type: "payment.succeeded", data: { id: "pay_6", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const oldTs = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const { headers } = signLikeWhop(rawBody, TEST_SECRET, { ts: oldTs });
    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === false, "rejected (ok=false)");
  }

  // === TEST 7: Timestamp in the future (>5 min ahead) → rejected ===
  console.log("\nTEST 7: Timestamp >5 min in the future → rejected");
  {
    const payload = { id: "evt_test7", type: "payment.succeeded", data: { id: "pay_7", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const futureTs = Math.floor(Date.now() / 1000) + 600;
    const { headers } = signLikeWhop(rawBody, TEST_SECRET, { ts: futureTs });
    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === false, "rejected (ok=false)");
  }

  // === TEST 8: Body re-serialization breaks signature ===
  // The signature covers the EXACT bytes. If the JSON is re-serialized
  // (e.g. by `await req.json()` then `JSON.stringify`), the signature won't
  // match — this is why the handler must use `await req.text()`.
  console.log("\nTEST 8: Re-serialized body → rejected (proves raw-body requirement)");
  {
    const payload = { id: "evt_test8", type: "payment.succeeded", data: { id: "pay_8", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const { headers } = signLikeWhop(rawBody);
    // Re-serialize with different formatting (extra spaces)
    const reSerialized = JSON.stringify(JSON.parse(rawBody), null, 2);
    const result = verifyWhopWebhook(reSerialized, headers);
    assert(result.ok === false, "rejected (ok=false) — proves raw-body requirement");
  }

  // === TEST 9: Header names are case-insensitive ===
  // standardwebhooks lowercases all keys before lookup.
  console.log("\nTEST 9: Header names case-insensitive (Webhook-Id vs webhook-id) → accepted");
  {
    const payload = { id: "evt_test9", type: "payment.succeeded", data: { id: "pay_9", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const { msgId, timestamp, headers: lowerHeaders } = signLikeWhop(rawBody);
    // Re-key with mixed-case names — the handler in route.ts already
    // lowercases keys, but even if it didn't, standardwebhooks would.
    const mixedCaseHeaders: Record<string, string> = {
      "Webhook-Id": msgId,
      "WEBHOOK-TIMESTAMP": timestamp,
      "Webhook-Signature": lowerHeaders["webhook-signature"],
    };
    const result = verifyWhopWebhook(rawBody, mixedCaseHeaders);
    assert(result.ok === true, "accepted (ok=true) — case-insensitive lookup works");
  }

  // === TEST 10: Real Whop-style payment.succeeded with test plan ===
  // This is the EXACT shape Whop sends for the $1 test plan payment.
  // It uses the plan_MheIAOiaGcRWe plan id and metadata.userId set by checkout.
  console.log("\nTEST 10: Realistic Whop payment.succeeded payload (test $1 plan) → accepted");
  {
    const payload = {
      id: "evt_msg_" + randomBytes(12).toString("hex"),
      type: "payment.succeeded",
      data: {
        id: "pay_" + randomBytes(12).toString("hex"),
        object: "payment",
        amount: 100, // cents
        currency: "usd",
        status: "paid",
        plan_id: "plan_MheIAOiaGcRWe",
        product_id: "prod_test",
        membership_id: null,
        metadata: {
          userId: "user_cuid_test_value",
          source: "allcombiner",
        },
        created_at: new Date().toISOString(),
      },
    };
    const rawBody = JSON.stringify(payload);
    const { headers } = signLikeWhop(rawBody);
    const result = verifyWhopWebhook(rawBody, headers);
    assert(result.ok === true, "signature accepted for realistic Whop payload");
    if (result.ok) {
      const event = result.event as any;
      assert(event.type === "payment.succeeded", "event.type extracted correctly");
      assert(event.data.metadata.userId === "user_cuid_test_value", "metadata.userId extracted correctly");
      assert(event.data.plan_id === "plan_MheIAOiaGcRWe", "plan_id extracted correctly (test $1 plan)");
    }
  }

  // === TEST 11: Stripe-style header (the OLD format) is REJECTED ===
  // This proves the migration is real — we no longer accept the broken
  // Stripe-style headers that the previous implementation expected.
  console.log("\nTEST 11: Legacy Stripe-style header (t=…,v1=…) → rejected");
  {
    const payload = { id: "evt_test11", type: "payment.succeeded", data: { id: "pay_11", plan_id: "plan_X", metadata: { userId: "u1" } } };
    const rawBody = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = createHmac("sha256", TEST_SECRET).update(`${ts}.${rawBody}`, "utf8").digest("hex");
    // Old broken format — should be REJECTED now.
    const stripeStyleHeaders = {
      "Whop-Signature": `t=${ts},v1=${sig}`,
    };
    const result = verifyWhopWebhook(rawBody, stripeStyleHeaders);
    assert(result.ok === false, "legacy Stripe-style format rejected (good — proves fix is real)");
  }

  // === Summary ===
  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
