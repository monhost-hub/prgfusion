import { AIProvider, FuseInput, FuseResult, TestModelInput, TestModelResult } from "../provider";
import { HttpError } from "@/lib/server";

/**
 * OpenRouterProvider — implements AIProvider against the OpenRouter API.
 *
 * Uses the /chat/completions endpoint (NOT /images/generations) because we
 * need to send TWO source images along with the prompt. The /images/
 * endpoint ignores source images.
 *
 * The generated image is returned in `message.images[0].image_url.url`
 * (NOT in `message.content`).
 *
 * The model id is supplied by the caller — read from the DB. The admin
 * can change it from the UI without touching code.
 *
 * Auth: Bearer token from process.env.OPENROUTER_API_KEY (server-side only).
 * Docs: https://openrouter.ai/docs
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  private get apiKey(): string {
    const k = process.env.OPENROUTER_API_KEY;
    if (!k) throw new HttpError(500, "OpenRouter API key is not configured");
    return k;
  }

  private get baseUrl(): string {
    return "https://openrouter.ai/api/v1";
  }

  /**
   * Returns the site URL used in the HTTP-Referer and X-Site-Url headers.
   * OpenRouter shows this in their dashboard rankings — and some models
   * use it for referrer-based filtering.
   */
  private get siteUrl(): string {
    return process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allcombiner.com";
  }

  private get appName(): string {
    return process.env.OPENROUTER_APP_NAME || "AllCombiner";
  }

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "HTTP-Referer": this.siteUrl,
      "X-Title": this.appName,
      "X-App-Name": this.appName,
    };
    if (process.env.OPENROUTER_SITE_URL) {
      h["X-Site-Url"] = process.env.OPENROUTER_SITE_URL;
    }
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  /**
   * Calls OpenRouter's /chat/completions endpoint with two image inputs.
   *
   * CRITICAL: the response image is in `choices[0].message.images[0].image_url.url`
   * (NOT in `message.content`). This is specific to image-generating models
   * like google/gemini-3.1-flash-image-preview (Nano Banana 2).
   */
  async fuse(input: FuseInput): Promise<FuseResult> {
    const body = {
      model: input.providerModelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: input.prompt },
            { type: "image_url", image_url: { url: input.imageA } },
            { type: "image_url", image_url: { url: input.imageB } },
          ],
        },
      ],
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      // The fusion typically takes ~9s, but we give a 120s ceiling for
      // safety (cold starts, large images, network jitter).
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const errText = await safeText(res);
      throw new HttpError(
        502,
        `OpenRouter error ${res.status}: ${errText.slice(0, 300)}`
      );
    }

    const data: any = await res.json();
    const choice = data?.choices?.[0];
    if (!choice) {
      throw new HttpError(502, "OpenRouter returned no choices");
    }

    // CRITICAL: extract the image from `message.images[0].image_url.url`
    // (NOT from `message.content` — which is null for image outputs)
    const imageUrl: string | undefined =
      choice?.message?.images?.[0]?.image_url?.url ??
      choice?.message?.image_url?.url;

    if (imageUrl) {
      return {
        imageUrl,
        estimatedCost: typeof data?.usage?.cost === "number" ? data.usage.cost : undefined,
        raw: data,
      };
    }

    // Fallback 1: some models embed the image URL in text content
    const text: string | undefined = choice?.message?.content;
    if (text) {
      const match = text.match(/https?:\/\/[^\s)'"<>]+\.(?:png|jpg|jpeg|webp)/i);
      if (match) {
        return { imageUrl: match[0], estimatedCost: data?.usage?.cost, raw: data };
      }
      // Fallback 2: data URL embedded in text
      const dataUrl = text.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=_]+/i);
      if (dataUrl) {
        return { imageUrl: dataUrl[0], estimatedCost: data?.usage?.cost, raw: data };
      }
    }

    // No image found — log the raw response for debugging (server-side only)
    console.error("[openrouter] No image in response. Raw:", JSON.stringify(data).slice(0, 500));
    throw new HttpError(502, "OpenRouter did not return a usable image");
  }

  async testModel(input: TestModelInput): Promise<TestModelResult> {
    const start = Date.now();
    try {
      // Light test: ask the model for any short text reply (no images).
      // This validates the API key + model id without burning a full fusion.
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: input.providerModelId,
          messages: [{ role: "user", content: "Reply with the single word: ok" }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `HTTP ${res.status}: ${(await safeText(res)).slice(0, 200)}`,
          latencyMs: Date.now() - start,
        };
      }
      const data: any = await res.json();
      if (!data?.choices?.length) {
        return { ok: false, error: "No choices in response", latencyMs: Date.now() - start };
      }
      return { ok: true, latencyMs: Date.now() - start };
    } catch (e: any) {
      return {
        ok: false,
        error: e?.message ?? "Unknown error",
        latencyMs: Date.now() - start,
      };
    }
  }

  async ping(): Promise<TestModelResult> {
    const start = Date.now();
    try {
      // GET /models is the lightest endpoint to check API key validity.
      const res = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `HTTP ${res.status}`,
          latencyMs: Date.now() - start,
        };
      }
      return { ok: true, latencyMs: Date.now() - start };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Unknown error", latencyMs: Date.now() - start };
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
