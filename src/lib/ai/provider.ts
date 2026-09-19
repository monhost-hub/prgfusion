/**
 * AIProvider — abstraction layer for image-fusion models.
 *
 * Concrete providers (e.g. OpenRouterProvider) implement `fuse()`.
 * Adding a new provider later (Replicate, Stability, in-house, …) only
 * requires implementing this interface and wiring it in `getProvider()`.
 *
 * The provider never reads the model id from a hardcoded constant — it
 * receives it from the caller (which reads it from the DB).
 */

export interface FuseInput {
  /** base64 data URL of reference image A */
  imageA: string;
  /** base64 data URL of reference image B */
  imageB: string;
  /** The fully-rendered prompt (placeholders already substituted) */
  prompt: string;
  /** The provider-specific model id (e.g. "google/nano-banana-2-lite") */
  providerModelId: string;
}

export interface FuseResult {
  /** base64 data URL of the generated image, OR a public URL */
  imageUrl: string;
  /** estimated cost in USD (informational) */
  estimatedCost?: number;
  /** raw provider response, for audit (kept server-side only) */
  raw?: unknown;
}

export interface TestModelInput {
  providerModelId: string;
}

export interface TestModelResult {
  ok: boolean;
  /** sanitized error message, no stack traces */
  error?: string;
  latencyMs?: number;
}

export interface AIProvider {
  readonly name: string;

  /** Generate a fused image from two references. */
  fuse(input: FuseInput): Promise<FuseResult>;

  /** Test that a given model id is reachable and returns a valid response. */
  testModel(input: TestModelInput): Promise<TestModelResult>;

  /** Ping the provider (used by Admin → OpenRouter "Test connection"). */
  ping(): Promise<TestModelResult>;
}

/**
 * Lazy provider registry.
 *
 * Providers are imported on-demand the first time they are requested. This
 * keeps cold-start fast (we only load the OpenRouter client code if a fusion
 * is actually requested) and lets us add new providers without changing the
 * fusion logic.
 *
 * To add a new provider:
 *   1. Implement the AIProvider interface in `providers/<name>.ts`.
 *   2. Add a case to the switch below.
 */
export async function getProvider(providerName: string): Promise<AIProvider> {
  switch (providerName.toLowerCase()) {
    case "openrouter": {
      const { OpenRouterProvider } = await import("./providers/openrouter");
      return new OpenRouterProvider();
    }
    default:
      throw new Error(`Unknown AI provider: ${providerName}`);
  }
}
