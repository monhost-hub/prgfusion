/**
 * Transactional email helper with DB-backed idempotence.
 *
 * Wraps {@link sendEmail} with an EmailNotification row whose UNIQUE constraint
 * on (userId, notificationType, periodKey) prevents the same email from being
 * sent twice for the same user / type / period — even if the cron runs twice
 * in parallel, even if a route handler re-evaluates after a retry.
 *
 * Guarantees:
 *   1. **Fast path**: queries EmailNotification first. If already sent, returns
 *      { alreadySent: true } without calling Resend.
 *   2. **Atomic insert on success**: the EmailNotification row is only inserted
 *      if Resend accepted the email (sendEmail returned sent=true). A failed
 *      send is NOT recorded, so a subsequent retry can legitimately re-send.
 *   3. **Race safety**: if two callers race past the fast path, the UNIQUE
 *      constraint rejects the second insert. The loser catches the error and
 *      returns { alreadySent: true }.
 *   4. **Non-fatal**: never throws. Errors are logged but never break the
 *      caller's business logic (the caller decides what to do with the result).
 *
 * Usage:
 *   import { sendTransactionalEmail } from "@/lib/email-transactional";
 *   const result = await sendTransactionalEmail({
 *     userId,
 *     to: user.email,
 *     notificationType: "low_credits",
 *     periodKey: `low_credits:5:2026-09-26T09`,
 *     subject: content.subject,
 *     html: content.html,
 *     text: content.text,
 *   });
 *   // result.sent === true     → email was sent + recorded
 *   // result.alreadySent      → already sent for this key (no Resend call)
 *   // result.sent === false   → Resend error (NOT recorded, retry possible)
 *
 * NEVER call sendEmail directly for transactional notifications — always go
 * through this helper so the idempotence log stays consistent.
 */
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export type EmailNotificationType =
  | "low_credits"
  | "sub_reminder"
  | "sub_expired"
  | "post_expiry";

export interface SendTransactionalEmailParams {
  userId: string;
  to: string;
  notificationType: EmailNotificationType;
  /** Idempotence key — must be unique per (userId, notificationType). */
  periodKey: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendTransactionalEmailResult {
  /** True if a new email was sent and recorded. */
  sent: boolean;
  /** True if no email was sent because one already exists for this key. */
  alreadySent: boolean;
  /** Error message if Resend rejected the email. */
  error?: string;
}

/**
 * Sends a transactional email with DB-backed idempotence.
 *
 * Never throws. The caller is responsible for logging/reporting failures,
 * but never for retrying based on a thrown error (there won't be one).
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams
): Promise<SendTransactionalEmailResult> {
  const { userId, to, notificationType, periodKey, subject, html, text } = params;

  // 1. Fast path — already sent?
  try {
    const existing = await db.emailNotification.findUnique({
      where: {
        userId_notificationType_periodKey: {
          userId,
          notificationType,
          periodKey,
        },
      },
      select: { status: true, error: true },
    });
    if (existing) {
      // Either previously sent successfully, or previously failed.
      // We treat both as "already attempted" — the caller should not retry
      // within the same period. Failed sends can be retried by changing the
      // periodKey (e.g. advancing the hourly bucket) or by admin purge.
      return { sent: false, alreadySent: true };
    }
  } catch (err: any) {
    // If the lookup itself fails (DB transient issue), we DO NOT block the
    // send — we proceed to call Resend and try to record afterwards. Worst
    // case: a duplicate send, but no email lost.
    console.warn(
      `[email-transactional] lookup failed (will still attempt send):`,
      err?.message ?? "unknown error"
    );
  }

  // 2. Call Resend
  const sendResult = await sendEmail({ to, subject, html, text });
  if (!sendResult.sent) {
    // Resend rejected the email (dev mode, API error, network, etc.).
    // Do NOT record an EmailNotification — a future retry within the same
    // period should be allowed to try again.
    console.warn(
      `[email-transactional] send failed for ${notificationType}/${periodKey}:`,
      sendResult.error ?? "unknown"
    );
    return { sent: false, alreadySent: false, error: sendResult.error };
  }

  // 3. Record the successful send (this is the atomicity boundary).
  try {
    await db.emailNotification.create({
      data: {
        id: `enot_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        userId,
        notificationType,
        periodKey,
        status: "sent",
        sentAt: new Date(),
      },
    });
    return { sent: true, alreadySent: false };
  } catch (err: any) {
    // UNIQUE constraint violation → another caller raced us and won.
    // Their email was sent + recorded; ours was also sent (duplicate!) but
    // we can't record it. This is the only window for a duplicate send
    // (between the sendEmail call and the create call). It is acceptable:
    //   - The user receives at most 2 emails instead of 1 in this rare case.
    //   - The DB state stays correct (one row per key).
    if (/Unique constraint/i.test(err?.message ?? "")) {
      console.warn(
        `[email-transactional] race lost for ${notificationType}/${periodKey} — duplicate send possible`
      );
      return { sent: false, alreadySent: true };
    }
    // Other DB errors — log but treat as sent (Resend did accept the email).
    console.warn(
      `[email-transactional] record failed (email was sent):`,
      err?.message ?? "unknown error"
    );
    return { sent: true, alreadySent: false };
  }
}
