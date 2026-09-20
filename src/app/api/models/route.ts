import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/models
 *
 * Returns all enabled AI models (public — no auth required).
 * Used by the /fusion page to populate the model selector.
 *
 * Returns:
 *   { models: [{ id, name, description, creditCost, isActive }] }
 */
export const GET = apiRoute(async () => {
  let models: any[] = [];
  try {
    models = await db.aIModel.findMany({
      where: { enabled: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        creditCost: true,
        isActive: true,
      },
    });
  } catch (err) {
    console.error("[/api/models] DB error:", err);
    // Return empty list — the UI will handle gracefully
    return NextResponse.json({ models: [] });
  }

  return NextResponse.json({ models });
});
