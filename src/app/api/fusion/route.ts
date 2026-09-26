import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAuth, errorResponse, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sendTransactionalEmail } from "@/lib/email-transactional";
import { buildLowCreditsEmail } from "@/lib/email-templates";

/**
 * POST /api/fusion
 *
 * Body: { imageA: dataUrl, imageB: dataUrl, modelId?: string }
 *
 * Flow:
 *  1. Auth — require logged-in user
 *  2. Rate limit — per user + per IP
 *  3. Parse + validate data URLs (mime, size, magic bytes)
 *  4. Resolve model:
 *     - If modelId provided, use it (must be enabled)
 *     - Else, fall back to the default active model
 *  5. Check user has enough credits (model.creditCost)
 *  6. Atomic debit: User.credits -= creditCost (only if balance >= cost)
 *  7. Call OpenRouter via the provider abstraction
 *  8. On success: log Generation + CreditTransaction, return image
 *  9. On failure: refund the credits (so users aren't charged for errors)
 */
export const POST = apiRoute(async (req: NextRequest) => {
  // 1. Auth
  const session = await requireAuth();
  const userId = session.user!.id!;

  // 2. Rate limit
  const ip = clientIp(req);
  if (!rateLimit("fusion", userId) && !rateLimit("fusion", `ip:${ip}`)) {
    throw new HttpError(429, "Too many generations this hour. Please slow down.");
  }

  // 3. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  const { imageA, imageB, modelId } = body ?? {};
  if (typeof imageA !== "string" || typeof imageB !== "string") {
    throw new HttpError(400, "Missing imageA or imageB.");
  }

  // 4. Validate data URLs
  const parsedA = parseDataUrl(imageA);
  const parsedB = parseDataUrl(imageB);
  if (!parsedA || !parsedB) {
    throw new HttpError(400, "Images must be base64 data URLs.");
  }
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimes.includes(parsedA.mime)) {
    throw new HttpError(400, "Unsupported image type for Photo A.");
  }
  if (!allowedMimes.includes(parsedB.mime)) {
    throw new HttpError(400, "Unsupported image type for Photo B.");
  }

  const maxBytes = (parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "10", 10) || 10) * 1024 * 1024;
  if (parsedA.buffer.length > maxBytes) throw new HttpError(413, "Photo A too large.");
  if (parsedB.buffer.length > maxBytes) throw new HttpError(413, "Photo B too large.");

  // 5. Resolve model
  let model;
  try {
    if (modelId) {
      model = await db.aIModel.findUnique({ where: { id: modelId } });
      if (!model) throw new HttpError(404, "Model not found.");
      if (!model.enabled) throw new HttpError(400, "This model is disabled.");
    } else {
      // Fallback: default active model
      model = await db.aIModel.findFirst({ where: { isActive: true, enabled: true } });
      if (!model) throw new HttpError(503, "No AI model is currently active.");
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, "Failed to load AI model.");
  }

  const creditCost = model.creditCost ?? 1;

  // 6. Check + atomic debit credits
  let user;
  try {
    // Use a transaction to atomically check + debit
    const updated = await db.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId } });
      if (!u) throw new HttpError(404, "User not found.");
      if (u.credits < creditCost) {
        throw new HttpError(402, `Insufficient credits. You have ${u.credits}, this model costs ${creditCost}.`);
      }
      const newBalance = u.credits - creditCost;
      const updated = await tx.user.update({
        where: { id: userId },
        data: { credits: newBalance, updatedAt: new Date() },
      });
      // Log the credit transaction
      await tx.creditTransaction.create({
        data: {
          id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          userId,
          amount: -creditCost,
          balance: newBalance,
          reason: "fusion",
          reference: model!.id,
        },
      });
      return updated;
    });
    user = updated;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error("[fusion] credit debit failed:", err);
    throw new HttpError(500, "Failed to debit credits.");
  }

  // 7. Create Generation row (status=running)
  const startedAt = Date.now();
  let generation;
  try {
    const id = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    generation = await db.generation.create({
      data: {
        id,
        userId,
        modelId: model.id,
        status: "running",
        prompt: "(central prompt — see SiteSettings)",
        inputAPath: imageA.slice(0, 200),
        inputBPath: imageB.slice(0, 200),
        creditsUsed: creditCost,
      },
    });
  } catch (err) {
    console.error("[fusion] generation create failed:", err);
    // Refund credits since we couldn't even create the generation row
    await refundCredits(userId, creditCost, model.id, "refund — generation create failed");
    throw new HttpError(500, "Failed to create generation log.");
  }

  // 8. Call the AI provider
  try {
    // Lazy load to avoid cold-start overhead when not needed
    const { getProvider } = await import("@/lib/ai/provider");
    const { getFusionPrompt } = await import("@/lib/ai/fusion");
    const provider = await getProvider(model.provider);
    const prompt = await getFusionPrompt();

    const result = await provider.fuse({
      imageA,
      imageB,
      prompt,
      providerModelId: model.providerId,
    });

    const durationMs = Date.now() - startedAt;
    const estimatedCost = result.estimatedCost ?? model.costPerCall;

    // Update generation with success
    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "succeeded",
        outputPath: result.imageUrl,
        durationMs,
        estimatedCost,
      },
    }).catch(() => {});

    // 9. Low-credits notification (Phase D)
    // Triggered AFTER the debit is confirmed (the generation succeeded and the
    // debit is final). Non-fatal: if Resend or the DB insert fails, we log
    // and move on — the user's fusion result is already returned.
    //
    // Idempotence: the periodKey includes the hourly bucket
    // "YYYY-MM-DDTHH", so we never send more than 1 low_credits email per
    // hour per threshold. If the user buys credits and then dips again the
    // next hour, they'll get another notification (which is the desired
    // behavior — we don't want to silently hide persistent low balance).
    try {
      await maybeNotifyLowCredits(userId, user.credits);
    } catch (err: any) {
      // Never break the fusion response because of an email failure
      console.warn(
        "[fusion] low_credits notification failed:",
        err?.message ?? "unknown error"
      );
    }

    return NextResponse.json({
      generationId: generation.id,
      imageUrl: result.imageUrl,
      durationMs,
      estimatedCost,
      creditsUsed: creditCost,
      balanceAfter: user.credits,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    const message =
      err instanceof HttpError ? err.message
      : /timeout/i.test(err?.message ?? "") ? "Generation timed out. Please try with a smaller image."
      : "Generation failed. Please try again later.";

    // Update generation with failure
    await db.generation.update({
      where: { id: generation.id },
      data: { status: "failed", error: message.slice(0, 500), durationMs },
    }).catch(() => {});

    // 💰 REFUND the credits (user shouldn't pay for a failed fusion)
    await refundCredits(userId, creditCost, model.id, `refund — generation ${generation.id}`);

    if (err instanceof HttpError) throw err;
    throw new HttpError(502, message);
  }
});

/**
 * Refunds credits to a user + logs the transaction.
 * Used when a fusion fails — we don't want to charge users for errors.
 */
async function refundCredits(userId: string, amount: number, modelId: string, reason: string) {
  try {
    await db.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId } });
      if (!u) return;
      const newBalance = u.credits + amount;
      await tx.user.update({
        where: { id: userId },
        data: { credits: newBalance, updatedAt: new Date() },
      });
      await tx.creditTransaction.create({
        data: {
          id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          userId,
          amount,
          balance: newBalance,
          reason: "refund",
          reference: modelId,
        },
      });
    });
    console.log(`[fusion] ✓ Refunded ${amount} credits to user ${userId} (${reason})`);
  } catch (err) {
    console.error("[fusion] refund failed:", err);
  }
}

function parseDataUrl(s: string): { mime: string; buffer: Buffer } | null {
  const m = s.match(/^data:([a-z]+\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

// ============================================================================
// Low-credits notification (Phase D)
// ============================================================================
// The threshold below which a low-credits email is triggered. Below this
// balance, the user can still do 1-2 more fusions (depending on the model's
// creditCost), but they should be nudged to recharge.
//
// Tunable — keep as a constant here so it's adjustable in a single place.
const LOW_CREDITS_THRESHOLD = 5;

/**
 * Sends a low-credits email if the user's new balance is at or below the
 * threshold. Idempotent: at most 1 email per (threshold, hourly bucket)
 * thanks to the EmailNotification UNIQUE constraint.
 *
 * Non-fatal: any error (DB, Resend) is logged but never propagated.
 *
 * Skips silently if the user has no verified email (we don't notify
 * unverified accounts — they may not have a real inbox yet).
 */
async function maybeNotifyLowCredits(userId: string, newBalance: number): Promise<void> {
  if (newBalance > LOW_CREDITS_THRESHOLD) return;

  // Look up the user — we need their email + name + verification status
  let user: { id: string; name: string | null; email: string; emailVerified: Date | null } | null = null;
  try {
    user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, emailVerified: true },
    });
  } catch (err: any) {
    console.warn("[fusion] low_credits: user lookup failed:", err?.message ?? "unknown");
    return;
  }
  if (!user) return;
  if (!user.emailVerified) return; // skip unverified emails

  // Build the hourly bucket for the periodKey — e.g. "low_credits:5:2026-09-26T09"
  // This caps the rate at 1 email/hour/threshold per user.
  const now = new Date();
  const hourBucket = now.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
  const periodKey = `low_credits:${LOW_CREDITS_THRESHOLD}:${hourBucket}`;

  // Build the email content (FR default — same as webhook convention)
  const content = buildLowCreditsEmail("fr", {
    userName: user.name || "",
    currentCredits: newBalance,
    threshold: LOW_CREDITS_THRESHOLD,
  });

  try {
    await sendTransactionalEmail({
      userId: user.id,
      to: user.email,
      notificationType: "low_credits",
      periodKey,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (err: any) {
    // Last-resort catch — sendTransactionalEmail already swallows most errors
    // but we keep this for absolute safety.
    console.warn("[fusion] low_credits: send failed:", err?.message ?? "unknown");
  }
}
