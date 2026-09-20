import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * POST /api/admin/users/[id]/credits
 *
 * Adjust a user's credit balance. Used by the admin UI to:
 *   - Add credits (recharge manuelle, bonus)
 *   - Remove credits (correction, penalty)
 *
 * Body: { amount: number, reason?: string }
 *   - amount > 0 → add credits
 *   - amount < 0 → remove credits (cannot go below 0)
 *
 * Logs the change in CreditTransaction for audit.
 *
 * Returns: { balance: number, transaction: {...} }
 */
export const POST = apiRoute(async (req: NextRequest, ctx) => {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json();

  const amount = parseInt(String(body?.amount ?? 0), 10);
  const reason = String(body?.reason || "admin_adjustment").trim();

  if (!Number.isFinite(amount) || amount === 0) {
    throw new HttpError(400, "amount must be a non-zero integer");
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "User not found");

  // Prevent admin from adjusting their own credits (avoid accidental lockout)
  if (id === session.user!.id) {
    throw new HttpError(400, "Cannot adjust your own credits");
  }

  const newBalance = Math.max(0, target.credits + amount);
  const actualDelta = newBalance - target.credits;

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { credits: newBalance, updatedAt: new Date() },
    });
    const txn = await tx.creditTransaction.create({
      data: {
        id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        userId: id,
        amount: actualDelta,
        balance: newBalance,
        reason,
        reference: `admin:${session.user!.id}`,
      },
    });
    return { updated, txn };
  });

  return NextResponse.json({
    balance: result.updated.credits,
    transaction: {
      id: result.txn.id,
      amount: result.txn.amount,
      reason: result.txn.reason,
      createdAt: result.txn.createdAt,
    },
  });
});
