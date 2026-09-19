import { db } from "@/lib/db";
import { getProvider } from "@/lib/ai/provider";
import { HttpError } from "@/lib/server";
import type { AIModel } from "@prisma/client";

/**
 * Default central fusion prompt.
 *
 * Used to seed SiteSettings.fusion_prompt on first run, and as a fallback
 * if the admin has not configured one yet. The placeholders {{imageA}} and
 * {{imageB}} are kept for documentation purposes — the actual image
 * references are attached as separate image_url parts in the OpenRouter
 * call. The prompt is sent as the text part.
 *
 * Identity preservation is the #1 priority by design — see product brief.
 */
export const DEFAULT_FUSION_PROMPT = `You are a portrait photographer AI. You will receive TWO reference photographs of TWO DIFFERENT people.

Your task: generate ONE single photorealistic photograph that shows BOTH people together in the same scene.

CRITICAL IDENTITY RULES (highest priority):
- Person 1 (from image {{imageA}}): preserve their identity exactly. Match face shape, eyes, eyebrows, nose, mouth, jawline, ears, hair, skin tone, age, and any distinctive features (scars, freckles, glasses, birthmarks, facial hair). Do NOT modify their apparent age or proportions.
- Person 2 (from image {{imageB}}): preserve their identity exactly. Same rules as Person 1.
- Do NOT blend, average, or morph the two faces.
- Do NOT invent a new face that resembles either.
- Do NOT swap features between the two people.
- Each person must be unmistakably recognizable to someone who knows them.

ANATOMY & INTERACTION:
- Natural, anatomically correct bodies.
- The two people should be in a believable, friendly interaction (e.g. standing next to each other, shaking hands, embracing, talking). Pose and gaze should connect them naturally.
- Avoid uncanny or impossible anatomy.

DECOR & AMBIANCE:
- Choose a tasteful, realistic environment (e.g. a softly-lit studio, an outdoor scene at golden hour, a modern interior). Keep it simple so the people remain the focus.
- Cinematic lighting, shallow depth of field, photorealistic color grading.

OUTPUT:
- ONE single image, photorealistic, no text overlay, no watermark, no border.
- Both people fully visible in frame.`;

/**
 * Returns the current fusion prompt from SiteSettings, falling back to
 * DEFAULT_FUSION_PROMPT if the admin has not customized it yet.
 */
export async function getFusionPrompt(): Promise<string> {
  const row = await db.siteSettings.findUnique({
    where: { key: "fusion_prompt" },
  });
  return row?.value?.trim() || DEFAULT_FUSION_PROMPT;
}

/**
 * Saves the fusion prompt in SiteSettings (upsert).
 */
export async function setFusionPrompt(value: string): Promise<void> {
  await db.siteSettings.upsert({
    where: { key: "fusion_prompt" },
    update: { value },
    create: {
      key: "fusion_prompt",
      value,
      description: "Central prompt sent to the AI model with the two reference images.",
    },
  });
}

/**
 * Returns the currently active AIModel (isActive=true AND enabled=true).
 * Throws 503 if no model is active.
 */
export async function getActiveModel(): Promise<AIModel> {
  const model = await db.aIModel.findFirst({
    where: { isActive: true, enabled: true },
  });
  if (!model) {
    throw new HttpError(503, "No AI model is currently active. Contact your administrator.");
  }
  return model;
}

/**
 * Sets a model as the active one. Ensures only ONE model is active at a time.
 */
export async function setActiveModel(modelId: string): Promise<void> {
  // Validate existence
  const m = await db.aIModel.findUnique({ where: { id: modelId } });
  if (!m) throw new HttpError(404, "Model not found");
  if (!m.enabled) throw new HttpError(400, "Cannot activate a disabled model");

  await db.$transaction([
    db.aIModel.updateMany({ data: { isActive: false } }),
    db.aIModel.update({ where: { id: modelId }, data: { isActive: true } }),
  ]);
}

export interface RunFusionInput {
  userId: string;
  imageADataUrl: string;
  imageBDataUrl: string;
}

export interface RunFusionOutput {
  generationId: string;
  imageUrl: string;
  durationMs: number;
  estimatedCost: number;
}

/**
 * End-to-end fusion run.
 *
 * 1. Reads the active model from DB (never hardcoded).
 * 2. Reads the central prompt from DB.
 * 3. Creates a Generation row with status=running.
 * 4. Calls the provider.
 * 5. Updates the row with the result (or error).
 *
 * All errors are sanitized before being re-thrown.
 */
export async function runFusion(input: RunFusionInput): Promise<RunFusionOutput> {
  const startedAt = Date.now();
  const model = await getActiveModel();
  const prompt = await getFusionPrompt();

  const generation = await db.generation.create({
    data: {
      userId: input.userId,
      modelId: model.id,
      status: "running",
      prompt,
      inputAPath: input.imageADataUrl.slice(0, 200),
      inputBPath: input.imageBDataUrl.slice(0, 200),
    },
  });

  try {
    const provider = await getProvider(model.provider);
    const result = await provider.fuse({
      imageA: input.imageADataUrl,
      imageB: input.imageBDataUrl,
      prompt,
      providerModelId: model.providerId,
    });

    const durationMs = Date.now() - startedAt;
    const estimatedCost = result.estimatedCost ?? model.costPerCall;

    await db.generation.update({
      where: { id: generation.id },
      data: {
        status: "succeeded",
        outputPath: result.imageUrl,
        durationMs,
        estimatedCost,
      },
    });

    return {
      generationId: generation.id,
      imageUrl: result.imageUrl,
      durationMs,
      estimatedCost,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    const message =
      err instanceof HttpError
        ? err.message
        : process.env.NODE_ENV !== "production"
          ? (err?.message ?? "Unknown error")
          : "Generation failed";

    await db.generation.update({
      where: { id: generation.id },
      data: { status: "failed", error: message.slice(0, 500), durationMs },
    });

    // Re-throw a sanitized error
    if (err instanceof HttpError) throw err;
    if (err?.name === "TimeoutError" || /timeout/i.test(err?.message ?? "")) {
      throw new HttpError(504, "Generation timed out. Please try with a smaller image.");
    }
    throw new HttpError(500, "Generation failed. Please try again later.");
  }
}
