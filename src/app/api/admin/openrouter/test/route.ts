import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { getProvider } from "@/lib/ai/provider";
import { db } from "@/lib/db";

/**
 * GET /api/admin/openrouter — returns configuration status (key never exposed)
 * POST /api/admin/openrouter/test — pings OpenRouter with the configured key
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);
  const activeModel = await db.aIModel.findFirst({ where: { isActive: true } });
  return NextResponse.json({
    configured: hasKey,
    // Never return the actual key, only a masked preview
    maskedKey: process.env.OPENROUTER_API_KEY
      ? `${process.env.OPENROUTER_API_KEY.slice(0, 3)}…${process.env.OPENROUTER_API_KEY.slice(-4)}`
      : null,
    activeModel: activeModel
      ? { id: activeModel.id, name: activeModel.name, providerId: activeModel.providerId }
      : null,
  });
});

export const POST = apiRoute(async () => {
  await requireAdmin();
  const provider = await getProvider("openrouter");
  const result = await provider.ping();
  if (!result.ok) throw new HttpError(502, result.error || "OpenRouter test failed");
  return NextResponse.json(result);
});
