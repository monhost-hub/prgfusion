import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { db } from "@/lib/db";

/**
 * GET /api/admin/site-settings — list all settings
 * POST /api/admin/site-settings — create or update a setting
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const settings = await db.siteSettings.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ settings });
});

export const POST = apiRoute(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const key = String(body?.key || "").trim();
  const value = String(body?.value || "");
  const description = body?.description ? String(body.description) : null;
  if (!key) throw new HttpError(400, "key is required.");
  if (value.length > 100_000) throw new HttpError(400, "value too long.");

  const setting = await db.siteSettings.upsert({
    where: { key },
    update: { value, description: description ?? undefined },
    create: { key, value, description: description ?? undefined },
  });
  return NextResponse.json({ setting });
});
