import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/stats
 * Returns dashboard statistics.
 */
export const GET = apiRoute(async () => {
  await requireAdmin();

  const [users, generations, succeeded, failed, last30, activeModel, recentGens] = await Promise.all([
    db.user.count(),
    db.generation.count(),
    db.generation.count({ where: { status: "succeeded" } }),
    db.generation.count({ where: { status: "failed" } }),
    db.generation.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    db.aIModel.findFirst({ where: { isActive: true } }),
    db.generation.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { estimatedCost: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const estimatedCost = recentGens
    .filter((g) => g.status === "succeeded")
    .reduce((sum, g) => sum + (g.estimatedCost || 0), 0);

  const successRate = generations > 0 ? Math.round((succeeded / generations) * 100) : 0;

  return NextResponse.json({
    users,
    generations,
    succeeded,
    failed,
    successRate,
    last30,
    activeModel: activeModel
      ? { id: activeModel.id, name: activeModel.name, providerId: activeModel.providerId }
      : null,
    estimatedCost: Number(estimatedCost.toFixed(4)),
  });
});
