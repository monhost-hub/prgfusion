import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";
import { isWhopConfigured, isSandbox } from "@/lib/whop";

/**
 * GET /api/admin/payments
 *
 * Returns:
 *   - whopConfigured: boolean (whether WHOP_COMPANY_API_KEY + WHOP_WEBHOOK_SECRET are set)
 *   - plans: all ENABLED pricing plans with their Whop config
 *     (legacy/duplicate plans are filtered out so the admin doesn't see them)
 *   - recentPayments: last 50 Whop payments
 *   - recentEvents: last 50 Whop events
 */
export const GET = apiRoute(async () => {
  await requireAdmin();

  const [plans, recentPayments, recentEvents, totalRevenue] = await Promise.all([
    db.pricingPlan.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { whopPayments: true } } },
    }).catch(() => []),
    db.whopPayment.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }).catch(() => []),
    db.whopEvent.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
    db.whopPayment.aggregate({
      where: { status: "succeeded" },
      _sum: { amount: true },
    }).catch(() => ({ _sum: { amount: 0 } })),
  ]);

  return NextResponse.json({
    whopConfigured: isWhopConfigured(),
    whopMode: isSandbox() ? "sandbox" : "production",
    totalRevenue: totalRevenue._sum.amount || 0,
    plans,
    recentPayments,
    recentEvents,
  });
});
