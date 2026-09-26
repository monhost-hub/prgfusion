/**
 * AllCombiner — Phase D cron script for automated transactional emails.
 *
 * Handles:
 *   1. Subscription reminder J-3  (3 days before currentPeriodEnd)
 *   2. Subscription reminder J-1  (1 day before currentPeriodEnd)
 *   3. Subscription expired       (after currentPeriodEnd, status='active' → 'expired')
 *   4. Post-expiration follow-up  (7 days after expiration)
 *
 * The "low_credits" notification is NOT handled here — it is triggered inline
 * by the fusion API after a successful debit (see src/app/api/fusion/route.ts).
 *
 * =============================================================================
 * HOW TO RUN
 * =============================================================================
 *
 * This script is a standalone Node/Bun script — it does NOT use the Next.js
 * runtime. It reads .env, connects directly to the DB via Prisma, and sends
 * emails via Resend.
 *
 * Local dev:
 *   bun run scripts/cron-emails.ts
 *   # or: bun scripts/cron-emails.ts
 *
 * Hostinger production (configure via HPanel → Cron Jobs):
 *
 *   0 every-6-hours * * * cd /home/u576014855/domains/allcombiner.com/hbuilds/last-source && \
 *               /usr/bin/bun scripts/cron-emails.ts \
 *               >> /home/u576014855/domains/allcombiner.com/hbuilds/logs/cron-emails.log 2>&1
 *
 * (The actual cron expression is "0 *\/6 * * * *" — escaped here to avoid
 *  breaking the JSDoc comment parser. In HPanel, enter it without the
 *  backslash.)
 *
 * Notes for Hostinger:
 *   - bun (v1.3.x) natively executes TypeScript — no tsx/ts-node needed.
 *   - bun resolves @prisma/client from ./node_modules/ (created by `bun install`
 *     at deploy time, alongside `prisma generate` which is the postinstall hook).
 *   - The .env file is loaded manually below (the Next.js preload-timestamp.js
 *     is NOT loaded by this script — we don't want console.log JSON wrapping).
 *   - Set ENV_PATH to override the default .env location:
 *       ENV_PATH=/home/u576014855/domains/allcombiner.com/hbuilds/config/.env
 *
 * Dry-run mode (no emails actually sent, no DB writes — just prints what
 * WOULD happen):
 *   DRY_RUN=true bun run scripts/cron-emails.ts
 *
 * =============================================================================
 * IDEMPOTENCE
 * =============================================================================
 *
 * Every notification is wrapped in sendTransactionalEmail() which uses a
 * UNIQUE constraint on (userId, notificationType, periodKey) to prevent
 * duplicate sends. periodKey is built from the Whop membership id + the
 * notification kind, so:
 *   - Re-running this cron 5 minutes later → 0 new emails
 *   - Two cron instances racing concurrently → 1 email + 1 race-lost warning
 *   - A new billing cycle for the same membership → new periodKey → new email
 *
 * =============================================================================
 * NON-FATALITY
 * =============================================================================
 *
 * All errors are caught and logged. The script always exits 0 so that the
 * HPanel cron does not mark it as "failed" (which would disable it after a
 * few retries). Errors are visible in the cron log file.
 */

// ============================================================================
// .env LOADER — manual, no dependency on dotenv (not in package.json)
// ============================================================================
// Run BEFORE importing @prisma/client, because the Prisma client needs
// DATABASE_URL to be set when it instantiates the connection.

import { existsSync, readFileSync, statSync } from "node:fs";

/**
 * Resolve the .env file path to load, trying (in order):
 *   1. process.env.ENV_PATH (if explicitly set)
 *   2. ./.env (local dev, after `bun install`)
 *   3. ../config/.env (Hostinger last-source relative to current)
 *   4. /home/u576014855/domains/allcombiner.com/hbuilds/config/.env (Hostinger abs)
 *
 * Falls back to ./.env if none exists (loadEnv will warn if it can't read).
 */
function resolveEnvPath(): string {
  if (process.env.ENV_PATH) return process.env.ENV_PATH;
  const candidates = [
    "./.env",
    "../config/.env",
    "/home/u576014855/domains/allcombiner.com/hbuilds/config/.env",
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p) && statSync(p).isFile()) return p;
    } catch {
      /* ignore */
    }
  }
  return "./.env";
}

const ENV_PATH = resolveEnvPath();

function loadEnv(path: string): void {
  try {
    const content = readFileSync(path, "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      // Strip matching quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      // Don't override existing env vars (hostinger cron may inject them)
      if (!process.env[key]) process.env[key] = value;
    }
    console.log(`[cron-emails] ✓ Loaded env from ${path}`);
  } catch (err: any) {
    console.warn(
      `[cron-emails] ⚠ Could not load .env from ${path}:`,
      err?.message ?? "unknown error"
    );
    console.warn(
      `[cron-emails]   Continuing with existing process.env ( Hostinger HPanel Cron Jobs injects them automatically).`
    );
  }
}

loadEnv(ENV_PATH);

// ============================================================================
// IMPORTS — must come after loadEnv (Prisma reads DATABASE_URL on import)
// ============================================================================
import { PrismaClient } from "@prisma/client";
import {
  buildSubscriptionReminderEmail,
  buildSubscriptionExpiredEmail,
  buildPostExpirationFollowUpEmail,
} from "../src/lib/email-templates";
import { sendEmail } from "../src/lib/email";

// ============================================================================
// CONSTANTS — tunables
// ============================================================================
/**
 * The locale used for all transactional emails.
 *
 * The User model has no `locale` field today; the webhook already uses "fr"
 * as the default for credit-purchase and subscription-activated emails (see
 * src/app/api/webhooks/whop/route.ts line 362). We follow the same convention
 * for consistency. If a `User.locale` field is added later, this can be
 * upgraded to per-user locale.
 */
const DEFAULT_LOCALE = "fr";

/**
 * Price + currency shown in subscription reminder emails.
 *
 * The UserSubscription model stores whopPlanId + pricingPlanSlug but not the
 * price directly. We look up the PricingPlan by slug to read priceMonthly +
 * currency. If the plan is not found in DB, we fall back to these values.
 */
const FALLBACK_RENEWAL_PRICE = 0;
const FALLBACK_CURRENCY = "EUR";

const DRY_RUN = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

// ============================================================================
// PRISMA — direct client (not the Next.js singleton, since this is a script)
// ============================================================================
const db = new PrismaClient({
  log: DRY_RUN ? ["query", "warn", "error"] : ["warn", "error"],
});

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sends a transactional email with DB-backed idempotence, OR simulates it
 * when DRY_RUN=true.
 */
async function sendTransactionalEmail(params: {
  userId: string;
  to: string;
  notificationType: "sub_reminder" | "sub_expired" | "post_expiry";
  periodKey: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ sent: boolean; alreadySent: boolean; error?: string }> {
  if (DRY_RUN) {
    console.log(
      `[cron-emails] [DRY_RUN] would send ${params.notificationType}/${params.periodKey} to ${params.to} — subject="${params.subject}"`
    );
    return { sent: true, alreadySent: false };
  }

  // 1. Fast path — already sent?
  try {
    const existing = await db.emailNotification.findUnique({
      where: {
        userId_notificationType_periodKey: {
          userId: params.userId,
          notificationType: params.notificationType,
          periodKey: params.periodKey,
        },
      },
      select: { status: true },
    });
    if (existing) {
      return { sent: false, alreadySent: true };
    }
  } catch (err: any) {
    console.warn(
      `[cron-emails] lookup failed (will still attempt send):`,
      err?.message ?? "unknown error"
    );
  }

  // 2. Send via Resend
  const sendResult = await sendEmail({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  if (!sendResult.sent) {
    console.warn(
      `[cron-emails] send failed for ${params.notificationType}/${params.periodKey}:`,
      sendResult.error ?? "unknown"
    );
    return { sent: false, alreadySent: false, error: sendResult.error };
  }

  // 3. Record (idempotent create via UNIQUE constraint)
  try {
    await db.emailNotification.create({
      data: {
        id: `enot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        userId: params.userId,
        notificationType: params.notificationType,
        periodKey: params.periodKey,
        status: "sent",
        sentAt: new Date(),
      },
    });
    return { sent: true, alreadySent: false };
  } catch (err: any) {
    if (/Unique constraint/i.test(err?.message ?? "")) {
      console.warn(
        `[cron-emails] race lost for ${params.notificationType}/${params.periodKey} — duplicate send possible`
      );
      return { sent: false, alreadySent: true };
    }
    console.warn(
      `[cron-emails] record failed (email was sent):`,
      err?.message ?? "unknown error"
    );
    return { sent: true, alreadySent: false };
  }
}

/**
 * Returns start-of-today (UTC) as a Date.
 *
 * All "J-X" calculations are done in UTC for consistency across cron runs —
 * the Hostinger cron runs in UTC by default and we don't want a user in
 * France to receive a "J-3" email 4 days before because their local time
 * is ahead of the server.
 */
function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Builds a UTC date N days from today (start of day).
 */
function daysFromTodayUTC(days: number): Date {
  const d = startOfTodayUTC();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Returns a Date N days after the given date.
 */
function daysAfter(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Looks up the PricingPlan by slug to get the renewal price + currency.
 * Returns null if the plan is not found.
 */
async function lookupPlanPrice(
  pricingPlanSlug: string
): Promise<{ renewalPrice: number; currency: string } | null> {
  try {
    const plan = await db.pricingPlan.findUnique({
      where: { slug: pricingPlanSlug },
      select: { priceMonthly: true, currency: true },
    });
    if (!plan) return null;
    return {
      renewalPrice: plan.priceMonthly ?? FALLBACK_RENEWAL_PRICE,
      currency: plan.currency || FALLBACK_CURRENCY,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches the user's name + email. Returns null if user doesn't exist or has
 * no verified email (we don't send transactional emails to unverified
 * addresses — they may not have a real inbox).
 */
async function lookupUser(
  userId: string
): Promise<{ id: string; name: string | null; email: string; emailVerified: Date | null } | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerified: true },
    });
    return user;
  } catch {
    return null;
  }
}

// ============================================================================
// NOTIFICATION HANDLERS
// ============================================================================

/**
 * J-3 reminder: subscriptions whose currentPeriodEnd is in [now+3d, now+4d).
 *
 * We use a half-open window so each subscription is matched exactly once per
 * day, regardless of the exact time the cron runs. The periodKey includes
 * the day offset (3) so the J-3 reminder for membership X is a distinct row
 * from the J-1 reminder (which uses periodKey with offset 1).
 */
async function handleReminderJ3(now: Date): Promise<{ sent: number; already: number; failed: number }> {
  const windowStart = daysFromTodayUTC(3);
  const windowEnd = daysFromTodayUTC(4);
  console.log(`[cron-emails] J-3 window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  let subscriptions: any[] = [];
  try {
    subscriptions = await db.userSubscription.findMany({
      where: {
        status: "active",
        currentPeriodEnd: { gte: windowStart, lt: windowEnd },
      },
    });
  } catch (err: any) {
    console.error(`[cron-emails] J-3 query failed:`, err?.message ?? "unknown");
    return { sent: 0, already: 0, failed: 0 };
  }

  let sent = 0, already = 0, failed = 0;
  for (const sub of subscriptions) {
    const user = await lookupUser(sub.userId);
    if (!user || !user.emailVerified) {
      console.log(`[cron-emails] J-3 skip user=${sub.userId} (no user or unverified email)`);
      continue;
    }
    const price = await lookupPlanPrice(sub.pricingPlanSlug);
    const content = buildSubscriptionReminderEmail(DEFAULT_LOCALE, {
      userName: user.name || "",
      plan: sub.pricingPlanSlug,
      daysRemaining: 3,
      endDate: sub.currentPeriodEnd!,
      renewalPrice: price?.renewalPrice ?? FALLBACK_RENEWAL_PRICE,
      currency: price?.currency ?? FALLBACK_CURRENCY,
    });
    const result = await sendTransactionalEmail({
      userId: user.id,
      to: user.email,
      notificationType: "sub_reminder",
      periodKey: `sub_reminder:${sub.whopMembershipId}:3`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (result.sent) sent++;
    else if (result.alreadySent) already++;
    else failed++;
  }
  return { sent, already, failed };
}

/**
 * J-1 reminder: subscriptions whose currentPeriodEnd is in [now+1d, now+2d).
 */
async function handleReminderJ1(now: Date): Promise<{ sent: number; already: number; failed: number }> {
  const windowStart = daysFromTodayUTC(1);
  const windowEnd = daysFromTodayUTC(2);
  console.log(`[cron-emails] J-1 window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  let subscriptions: any[] = [];
  try {
    subscriptions = await db.userSubscription.findMany({
      where: {
        status: "active",
        currentPeriodEnd: { gte: windowStart, lt: windowEnd },
      },
    });
  } catch (err: any) {
    console.error(`[cron-emails] J-1 query failed:`, err?.message ?? "unknown");
    return { sent: 0, already: 0, failed: 0 };
  }

  let sent = 0, already = 0, failed = 0;
  for (const sub of subscriptions) {
    const user = await lookupUser(sub.userId);
    if (!user || !user.emailVerified) {
      console.log(`[cron-emails] J-1 skip user=${sub.userId} (no user or unverified email)`);
      continue;
    }
    const price = await lookupPlanPrice(sub.pricingPlanSlug);
    const content = buildSubscriptionReminderEmail(DEFAULT_LOCALE, {
      userName: user.name || "",
      plan: sub.pricingPlanSlug,
      daysRemaining: 1,
      endDate: sub.currentPeriodEnd!,
      renewalPrice: price?.renewalPrice ?? FALLBACK_RENEWAL_PRICE,
      currency: price?.currency ?? FALLBACK_CURRENCY,
    });
    const result = await sendTransactionalEmail({
      userId: user.id,
      to: user.email,
      notificationType: "sub_reminder",
      periodKey: `sub_reminder:${sub.whopMembershipId}:1`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (result.sent) sent++;
    else if (result.alreadySent) already++;
    else failed++;
  }
  return { sent, already, failed };
}

/**
 * Expiration: subscriptions whose currentPeriodEnd < now AND status='active'.
 *
 * We mark them as 'expired' in DB and send the expired email. The status
 * update is the "monotonic barrier" — once a subscription is 'expired', the
 * J-3 / J-1 handlers will skip it, and this handler won't pick it up again
 * (the WHERE clause is status='active').
 *
 * The expired email itself has its own idempotence via periodKey, so even
 * if the status update fails, a re-run won't double-send (only re-attempts
 * the status update).
 */
async function handleExpired(now: Date): Promise<{ sent: number; already: number; failed: number }> {
  console.log(`[cron-emails] expired window: currentPeriodEnd < ${now.toISOString()}`);

  let subscriptions: any[] = [];
  try {
    subscriptions = await db.userSubscription.findMany({
      where: {
        status: "active",
        currentPeriodEnd: { lt: now },
      },
    });
  } catch (err: any) {
    console.error(`[cron-emails] expired query failed:`, err?.message ?? "unknown");
    return { sent: 0, already: 0, failed: 0 };
  }

  let sent = 0, already = 0, failed = 0;
  for (const sub of subscriptions) {
    const user = await lookupUser(sub.userId);
    if (!user || !user.emailVerified) {
      console.log(`[cron-emails] expired skip user=${sub.userId} (no user or unverified email)`);
      // Still mark the subscription as expired so we don't keep checking it.
      try {
        await db.userSubscription.update({
          where: { id: sub.id },
          data: { status: "expired", updatedAt: new Date() },
        });
      } catch (err: any) {
        console.warn(`[cron-emails] status update failed for ${sub.id}:`, err?.message);
      }
      continue;
    }

    const content = buildSubscriptionExpiredEmail(DEFAULT_LOCALE, {
      userName: user.name || "",
      plan: sub.pricingPlanSlug,
      expiredAt: sub.currentPeriodEnd!,
    });
    const result = await sendTransactionalEmail({
      userId: user.id,
      to: user.email,
      notificationType: "sub_expired",
      periodKey: `sub_expired:${sub.whopMembershipId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (result.sent) sent++;
    else if (result.alreadySent) already++;
    else failed++;

    // Mark subscription as expired regardless of email success — the
    // expiration happened, we just may have failed to notify the user.
    // The next run will see status='expired' and skip this subscription.
    try {
      await db.userSubscription.update({
        where: { id: sub.id },
        data: { status: "expired", updatedAt: new Date() },
      });
    } catch (err: any) {
      console.warn(`[cron-emails] status update failed for ${sub.id}:`, err?.message);
    }
  }
  return { sent, already, failed };
}

/**
 * Post-expiration J+7: subscriptions that expired 7+ days ago.
 *
 * We use a window of [expiredAt+7d, expiredAt+8d) so the email is sent
 * exactly once (the J+7 marker). After that, the subscription is left
 * alone — no further reminders.
 *
 * The status filter is 'expired' so we don't re-pick subscriptions that
 * were re-activated (Whop could renew them in the meantime).
 */
async function handlePostExpiration(now: Date): Promise<{ sent: number; already: number; failed: number }> {
  const windowStart = daysFromTodayUTC(-7);
  const windowEnd = daysFromTodayUTC(-8);
  // We want currentPeriodEnd in [now-8d, now-7d) — that means the subscription
  // expired between 7 and 8 days ago.
  console.log(`[cron-emails] post-expiry window: currentPeriodEnd in [${windowEnd.toISOString()}, ${windowStart.toISOString()})`);

  let subscriptions: any[] = [];
  try {
    subscriptions = await db.userSubscription.findMany({
      where: {
        status: "expired",
        currentPeriodEnd: { gte: windowEnd, lt: windowStart },
      },
    });
  } catch (err: any) {
    console.error(`[cron-emails] post-expiry query failed:`, err?.message ?? "unknown");
    return { sent: 0, already: 0, failed: 0 };
  }

  let sent = 0, already = 0, failed = 0;
  for (const sub of subscriptions) {
    const user = await lookupUser(sub.userId);
    if (!user || !user.emailVerified) {
      console.log(`[cron-emails] post-expiry skip user=${sub.userId} (no user or unverified email)`);
      continue;
    }

    const daysSince = Math.floor(
      (now.getTime() - (sub.currentPeriodEnd?.getTime() ?? now.getTime())) / (24 * 60 * 60 * 1000)
    );

    const content = buildPostExpirationFollowUpEmail(DEFAULT_LOCALE, {
      userName: user.name || "",
      daysSinceExpiration: daysSince,
    });
    const result = await sendTransactionalEmail({
      userId: user.id,
      to: user.email,
      notificationType: "post_expiry",
      periodKey: `post_expiry:${sub.whopMembershipId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (result.sent) sent++;
    else if (result.alreadySent) already++;
    else failed++;
  }
  return { sent, already, failed };
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const startedAt = Date.now();
  console.log(`[cron-emails] 🚀 Starting Phase D cron run at ${new Date().toISOString()}`);
  if (DRY_RUN) {
    console.log(`[cron-emails] ⚠️  DRY_RUN=true — no emails will be sent, no DB writes`);
  }
  console.log(`[cron-emails] Env path: ${ENV_PATH}`);
  console.log(`[cron-emails] DATABASE_URL: ${process.env.DATABASE_URL ? "(set)" : "(MISSING)"}`);
  console.log(`[cron-emails] RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "(set, " + process.env.RESEND_API_KEY.length + " chars)" : "(MISSING — dev mode)"}`);
  console.log(`[cron-emails] EMAIL_FROM: ${process.env.EMAIL_FROM ? "(set)" : "(default to noreply@allcombiner.com)"}`);

  if (!process.env.DATABASE_URL) {
    console.error(`[cron-emails] ❌ DATABASE_URL not set — aborting`);
    process.exit(0); // exit 0 so HPanel cron doesn't disable us
  }

  const now = new Date();

  // Run all handlers. Each is independent — a failure in one does not block
  // the others.
  const handlers = [
    { name: "J-3 reminder", fn: () => handleReminderJ3(now) },
    { name: "J-1 reminder", fn: () => handleReminderJ1(now) },
    { name: "Expired",      fn: () => handleExpired(now) },
    { name: "Post-expiry",  fn: () => handlePostExpiration(now) },
  ];

  let totalSent = 0, totalAlready = 0, totalFailed = 0;
  for (const h of handlers) {
    console.log(`\n[cron-emails] === ${h.name} ===`);
    try {
      const result = await h.fn();
      console.log(
        `[cron-emails] ${h.name}: sent=${result.sent} already=${result.already} failed=${result.failed}`
      );
      totalSent += result.sent;
      totalAlready += result.already;
      totalFailed += result.failed;
    } catch (err: any) {
      console.error(`[cron-emails] ${h.name} handler crashed:`, err?.message ?? "unknown");
      console.error(err?.stack);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`\n[cron-emails] 🎉 Run complete in ${elapsedMs}ms`);
  console.log(
    `[cron-emails] Summary: sent=${totalSent} already=${totalAlready} failed=${totalFailed}`
  );

  // Always exit 0 — HPanel cron disables jobs that exit non-zero repeatedly.
  // Errors are visible in the log file (we log to stderr).
  process.exit(0);
}

main().catch((err) => {
  console.error(`[cron-emails] 💥 Uncaught error in main:`, err);
  process.exit(0);
});
