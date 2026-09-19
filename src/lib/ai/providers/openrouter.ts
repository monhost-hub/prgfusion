import { AIProvider, FuseInput, FuseResult, TestModelInput, TestModelResult } from "../provider";
import { HttpError } from "@/lib/server";

/**
 * OpenRouterProvider — implements AIProvider against the OpenRouter API.
 *
 * Docs: https://openrouter.ai/docs
 * Auth: Bearer token from process.env.OPENROUTER_API_KEY (server-side only).
 *
 * The model id is supplied by the caller — never hardcoded here. The admin
 * can edit providerModelId in the DB to point to a different OpenRouter
 * model without touching code.
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

  private headers(json = true): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "X-App-Name": process.env.OPENROUTER_APP_NAME ?? "AllCombiner",
    };
    if (process.env.OPENROUTER_SITE_URL) {
      h["X-Site-Url"] = process.env.OPENROUTER_SITE_URL;
    }
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  /**
   * Calls OpenRouter's chat completions endpoint with two image inputs and
   * asks for a single image output. We request `modalities: ["image","text"]`
   * so the model can return an image.
   *
   * Note: OpenRouter routes the request to the underlying provider model.
   * Different models expose image output differently (some return a URL in
   * the text, some return an `images` array). We handle both.
   */
  async fuse(input: FuseInput): Promise<FuseResult> {
    const body = {
      model: input.providerModelId,
      modalities: ["image", "text"],
      // We instruct the model in the user message itself; no separate system
      // message because some image models ignore system messages.
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
      // OpenRouter can take 30-60s on first call to a model (cold start).
      // We give 120s ceiling.
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      throw new HttpError(
        502,
        `OpenRouter error ${res.status}: ${await safeText(res)}`
      );
    }

    const data: any = await res.json();
    const choice = data?.choices?.[0];
    if (!choice) {
      throw new HttpError(502, "OpenRouter returned no choices");
    }

    // Case 1: model returned an image directly (modalities: image)
    const imgPart = choice?.message?.images?.[0]?.image_url?.url
      ?? choice?.message?.image_url?.url;
    if (imgPart) {
      return {
        imageUrl: imgPart,
        estimatedCost: typeof data?.usage?.cost === "number" ? data.usage.cost : undefined,
        raw: data,
      };
    }

    // Case 2: model returned a URL inside the text content
    const text: string | undefined = choice?.message?.content;
    if (text) {
      const match = text.match(/https?:\/\/[^\s)'"<>]+\.(?:png|jpg|jpeg|webp)/i);
      if (match) {
        return { imageUrl: match[0], estimatedCost: data?.usage?.cost, raw: data };
      }
      // Case 3: model returned a base64 data URL inside text
      const dataUrl = text.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=_]+/i);
      if (dataUrl) {
        return { imageUrl: dataUrl[0], estimatedCost: data?.usage?.cost, raw: data };
      }
    }

    // Could not extract an image
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
