/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * We use this to initialize the database at RUNTIME (not build time),
 * because on Hostinger the env vars are only available at runtime.
 *
 * Docs: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  // Only run on the server (not in the edge / build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureDbInitialized } = await import("./lib/db-init");
    await ensureDbInitialized();
  }
}
