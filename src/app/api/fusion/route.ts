import { NextRequest, NextResponse } from "next/server";
import { apiRoute, requireAuth, errorResponse, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { runFusion } from "@/lib/ai/fusion";
import { validateImageFile, sniffImageMime } from "@/lib/upload";
import { db } from "@/lib/db";

/**
 * POST /api/fusion
 *
 * Body: { imageA: dataUrl, imageB: dataUrl }
 *
 * Validates the two input images, rate-limits per user+IP, runs the fusion
 * using the currently active AI model (read from DB), persists a Generation
 * row, and returns the output image URL.
 */
export const POST = apiRoute(async (req: NextRequest) => {
  // 1. Auth
  const session = await requireAuth();

  // 2. Rate limit (per user, fallback to IP)
  const ip = clientIp(req);
  if (!rateLimit("fusion", session.user!.id!) && !rateLimit("fusion", `ip:${ip}`)) {
    throw new HttpError(429, "Too many generations this hour. Please slow down.");
  }

  // 3. Parse body
  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  const { imageA, imageB } = body ?? {};
  if (typeof imageA !== "string" || typeof imageB !== "string") {
    throw new HttpError(400, "Missing imageA or imageB.");
  }

  // 4. Validate data URLs (must be data:image/...;base64,...)
  const parsedA = parseDataUrl(imageA);
  const parsedB = parseDataUrl(imageB);
  if (!parsedA || !parsedB) {
    throw new HttpError(400, "Images must be base64 data URLs.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(parsedA.mime)) {
    throw new HttpError(400, "Unsupported image type for Photo A.");
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(parsedB.mime)) {
    throw new HttpError(400, "Unsupported image type for Photo B.");
  }

  // 5. Size limits (base64 size ≈ 4/3 of binary size)
  const maxBytes = (parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? "10", 10) || 10) * 1024 * 1024;
  if (parsedA.buffer.length > maxBytes) throw new HttpError(413, "Photo A too large.");
  if (parsedB.buffer.length > maxBytes) throw new HttpError(413, "Photo B too large.");

  // 6. Magic-byte check
  const mimeA = sniffImageMime(new Uint8Array(parsedA.buffer.slice(0, 16)));
  const mimeB = sniffImageMime(new Uint8Array(parsedB.buffer.slice(0, 16)));
  if (!mimeA) throw new HttpError(400, "Photo A content is not a supported image.");
  if (!mimeB) throw new HttpError(400, "Photo B content is not a supported image.");

  // 7. Run fusion (uses active model from DB, central prompt from DB)
  const result = await runFusion({
    userId: session.user!.id!,
    imageADataUrl: imageA,
    imageBDataUrl: imageB,
  });

  return NextResponse.json({
    generationId: result.generationId,
    imageUrl: result.imageUrl,
    durationMs: result.durationMs,
    estimatedCost: result.estimatedCost,
  });
});

function parseDataUrl(s: string): { mime: string; buffer: Buffer } | null {
  const m = s.match(/^data:([a-z]+\/[a-z+.-]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}
