/**
 * End-to-end HTTP test for the Whop webhook handler.
 *
 * Run: `bun run scripts/test-whop-e2e.ts`
 *
 * This test:
 *   1. Starts the Next.js production server (`next start`) on a random port.
 *   2. Sends a real Standard Webhooks-signed POST to /api/webhooks/whop.
 *   3. Asserts that the response is NOT 401 (signature passes).
 *   4. Asserts that the response IS either 200 (DB available + idempotent) or
 *      500 (DB unavailable in this test env — but signature was accepted).
 *
 * The critical assertion: a 401 response means signature failed.
 * Anything else means the signature layer works.
 *
 * This complements test-whop-signature.ts (unit-level) by exercising the
 * full HTTP path through Next.js's runtime, headers parsing, and the
 * route handler.
 */

import { spawn, ChildProcess } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { createServer } from "node:net";

const TEST_SECRET = "ws_" + randomBytes(24).toString("hex");

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        reject(new Error("Could not get port"));
      }
    });
  });
}

function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.status < 500) {
          resolve();
          return;
        }
      } catch {
        // not up yet
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server at ${url} did not come up within ${timeoutMs}ms`));
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

function signLikeWhop(rawBody: string, secret: string) {
  const msgId = "msg_" + randomBytes(12).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000).toString();
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
  let passed = 0;
  let failed = 0;
  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  ✅ ${msg}`);
      passed++;
    } else {
      console.log(`  ❌ ${msg}`);
      failed++;
    }
  }

  console.log("\n=== Whop Webhook End-to-End HTTP Test ===\n");

  const port = await getFreePort();
  console.log(`Starting Next.js on port ${port}…`);

  const env = {
    ...process.env,
    WHOP_WEBHOOK_SECRET: TEST_SECRET,
    WHOP_COMPANY_API_KEY: "test_key_for_e2e",
    NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
    // Use SQLite so we don't need a MySQL instance — the test only cares
    // that the signature is accepted, not that the DB operations succeed.
    DATABASE_URL: "file:./e2e-test.db",
    AUTH_SECRET: "e2e-test-secret-not-for-prod",
  };

  // Build was already done — start the production server.
  const child: ChildProcess = spawn(
    "npx",
    ["next", "start", "-p", String(port)],
    { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] }
  );

  let serverLog = "";
  child.stdout?.on("data", (d) => {
    const s = d.toString();
    serverLog += s;
    if (process.env.E2E_VERBOSE) process.stdout.write(s);
  });
  child.stderr?.on("data", (d) => {
    const s = d.toString();
    serverLog += s;
    if (process.env.E2E_VERBOSE) process.stderr.write(s);
  });

  try {
    const baseUrl = `http://localhost:${port}`;
    await waitForServer(`${baseUrl}/api/webhooks/whop`, 60000);
    console.log("Server is up.\n");

    // === TEST 1: Valid signature → handler accepts (NOT 401) ===
    console.log("TEST 1: Valid Standard Webhooks signature → handler accepts (≠ 401)");
    {
      const payload = {
        id: "evt_e2e_" + Date.now(),
        type: "payment.succeeded",
        data: {
          id: "pay_e2e_" + Date.now(),
          metadata: { userId: "user_e2e_test" },
          plan_id: "plan_MheIAOiaGcRWe",
          amount: 100,
          currency: "usd",
        },
      };
      const rawBody = JSON.stringify(payload);
      const { headers } = signLikeWhop(rawBody, TEST_SECRET);

      const res = await fetch(`${baseUrl}/api/webhooks/whop`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: rawBody,
      });
      const text = await res.text();

      assert(res.status !== 401, `response is NOT 401 (got ${res.status})`);
      assert(res.status !== 400, `response is NOT 400 (got ${res.status}) — JSON parsed correctly`);
      console.log(`    Response: ${res.status} ${text.slice(0, 200)}`);
      // Acceptable outcomes:
      //   200 → DB available, event processed (test env has SQLite, might work)
      //   500 → DB error in test env (signature passed, DB op failed)
      //   503 → Whop not configured (shouldn't happen, we set the env)
      // Not acceptable: 401 (signature failed) or 400 (bad JSON).
      assert(
        res.status === 200 || res.status === 500,
        `response is 200 or 500 (got ${res.status}) — signature accepted, DB outcome irrelevant for this test`
      );
    }

    // === TEST 2: Invalid signature → 401 ===
    console.log("\nTEST 2: Invalid signature → 401");
    {
      const payload = {
        id: "evt_e2e_bad_" + Date.now(),
        type: "payment.succeeded",
        data: { id: "pay_bad", metadata: { userId: "u" }, plan_id: "plan_X" },
      };
      const rawBody = JSON.stringify(payload);
      const { msgId, timestamp } = signLikeWhop(rawBody, TEST_SECRET);
      // Re-sign with a wrong secret
      const wrongSig = createHmac("sha256", "ws_WRONG")
        .update(`${msgId}.${timestamp}.${rawBody}`, "utf8")
        .digest("base64");
      const headers = {
        "webhook-id": msgId,
        "webhook-timestamp": timestamp,
        "webhook-signature": `v1,${wrongSig}`,
      };

      const res = await fetch(`${baseUrl}/api/webhooks/whop`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: rawBody,
      });
      const text = await res.text();
      assert(res.status === 401, `response is 401 (got ${res.status})`);
      console.log(`    Response: ${res.status} ${text.slice(0, 200)}`);
    }

    // === TEST 3: Missing signature headers → 401 ===
    console.log("\nTEST 3: Missing webhook-signature header → 401");
    {
      const payload = {
        id: "evt_e2e_missing_" + Date.now(),
        type: "payment.succeeded",
        data: { id: "pay_missing", metadata: { userId: "u" }, plan_id: "plan_X" },
      };
      const rawBody = JSON.stringify(payload);
      const res = await fetch(`${baseUrl}/api/webhooks/whop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: rawBody,
      });
      const text = await res.text();
      assert(res.status === 401, `response is 401 (got ${res.status})`);
      console.log(`    Response: ${res.status} ${text.slice(0, 200)}`);
    }
  } finally {
    console.log("\nShutting down server…");
    child.kill("SIGTERM");
    await new Promise((r) => child.on("exit", r));
  }

  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
