import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/provider";

/**
 * POST /api/admin/models/[id]/test
 * Tests that a model responds correctly via its provider.
 */
export const POST = apiRoute(async (_req: NextRequest, ctx) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const model = await db.aIModel.findUnique({ where: { id } });
  if (!model) throw new HttpError(404, "Model not found.");

  const provider = await getProvider(model.provider);
  const result = await provider.testModel({ providerModelId: model.providerId });

  return NextResponse.json(result);
});
