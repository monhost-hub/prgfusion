import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/models  — list all models
 * POST /api/admin/models — create a new model
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const models = await db.aIModel.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ models });
});

export const POST = apiRoute(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();

  const name = String(body?.name || "").trim();
  const providerId = String(body?.providerId || "").trim();
  const provider = String(body?.provider || "openrouter").trim() || "openrouter";
  const description = String(body?.description || "").trim() || null;
  const costPerCall = Number(body?.costPerCall || 0);
  const creditCost = parseInt(String(body?.creditCost ?? 1), 10);
  const enabled = Boolean(body?.enabled ?? true);
  const isActive = Boolean(body?.isActive ?? false);

  if (!name || !providerId) throw new HttpError(400, "name and providerId are required.");
  if (!Number.isFinite(costPerCall) || costPerCall < 0) throw new HttpError(400, "Invalid costPerCall.");
  if (!Number.isFinite(creditCost) || creditCost < 1) throw new HttpError(400, "creditCost must be >= 1.");

  // If new model is active, deactivate all others.
  if (isActive) {
    await db.aIModel.updateMany({ data: { isActive: false } });
  }

  const model = await db.aIModel.create({
    data: { name, providerId, provider, description, costPerCall, creditCost, enabled, isActive },
  });
  return NextResponse.json({ model });
});
