/**
 * Simple in-memory rate limiter (per-IP, per-route family).
 *
 * For production at scale you'd swap this for Redis or Upstash — but for a
 * single-instance deployment the in-memory implementation is enough to stop
 * casual abuse of the AI pipeline and contact form.
 *
 * Limits are configurable via env vars:
 *   RATE_LIMIT_FUSION_PER_HOUR=10
 *   RATE_LIMIT_CONTACT_PER_HOUR=5
 *   RATE_LIMIT_AUTH_PER_HOUR=20
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function limitFor(family: string): number {
  const env: Record<string, string | undefined> = {
    fusion: process.env.RATE_LIMIT_FUSION_PER_HOUR,
    contact: process.env.RATE_LIMIT_CONTACT_PER_HOUR,
    auth: process.env.RATE_LIMIT_AUTH_PER_HOUR,
  };
  const raw = env[family];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return family === "auth" ? 20 : family === "contact" ? 5 : 10;
  }
  return parsed;
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Mutates the bucket to record the attempt.
 */
export function rateLimit(family: string, key: string, windowMs = 60 * 60 * 1000): boolean {
  const k = `${family}:${key}`;
  const now = Date.now();
  const max = limitFor(family);

  const existing = buckets.get(k);
  if (!existing || existing.resetAt < now) {
    buckets.set(k, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= max) {
    return false;
  }
  existing.count += 1;
  return true;
}

/**
 * Extracts a best-effort client IP from a Next.js request.
 * Falls back to "unknown" if no IP can be determined.
 */
export function clientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

// Periodically purge expired buckets to avoid memory growth.
// (Run only on the server, in long-lived Node/Bun processes.)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k);
    }
  }, 5 * 60 * 1000).unref?.();
}
