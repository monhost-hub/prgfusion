import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Returns the current session or null. Never throws.
 */
export async function getSession() {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

/**
 * Returns the current user id or null.
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Throws a 401 response if the user is not authenticated.
 * Returns the session otherwise.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return session;
}

/**
 * Throws a 403 response if the user is not an admin.
 * Returns the session otherwise.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  return session;
}

/**
 * HTTP error with status code, used by API routes.
 * The message is sanitized (no stack traces) before being sent to clients.
 */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Converts any thrown error into a JSON NextResponse with a sanitized message.
 * Never leaks stack traces or internal details to the client.
 */
export function errorResponse(err: unknown, fallback = "Internal server error") {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  // Log the real error server-side only
  console.error("[api] unhandled error:", err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/**
 * Sanitizes any thrown error into a safe public message for the client.
 * Used when the API needs to return a structured response (not just a JSON error).
 */
export function publicErrorMessage(err: unknown, fallback = "Internal server error"): string {
  if (err instanceof HttpError) return err.message;
  if (err instanceof Error && process.env.NODE_ENV !== "production") {
    return err.message;
  }
  return fallback;
}

export type ApiHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API handler with:
 * - Error boundary (catches HttpError → JSON response, anything else → 500)
 * - Method allow-list
 */
export function apiRoute(
  handler: ApiHandler,
  options: { methods?: string[] } = {}
): ApiHandler {
  const allowed = options.methods?.map((m) => m.toUpperCase());
  return async (req, ctx) => {
    try {
      if (allowed && !allowed.includes(req.method?.toUpperCase() ?? "")) {
        return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
      }
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
