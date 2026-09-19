import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAdmin, HttpError } from "@/lib/server";
import { getFusionPrompt, setFusionPrompt } from "@/lib/ai/fusion";

/**
 * GET /api/admin/fusion-settings — returns the current central prompt
 * PUT /api/admin/fusion-settings — saves a new central prompt
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  const prompt = await getFusionPrompt();
  return NextResponse.json({ prompt });
});

export const PUT = apiRoute(async (req: NextRequest) => {
  await requireAdmin();
  const body = await req.json();
  const prompt = String(body?.prompt || "").trim();
  if (!prompt) throw new HttpError(400, "Prompt cannot be empty.");
  if (prompt.length > 8000) throw new HttpError(400, "Prompt too long (max 8000 chars).");
  await setFusionPrompt(prompt);
  return NextResponse.json({ ok: true });
});
