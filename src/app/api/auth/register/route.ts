import { NextRequest, NextResponse } from "next/server";
import { apiRoute, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * POST /api/auth/register
 * Body: { email, name?, password }
 *
 * Creates a new USER account. Password is hashed with bcrypt.
 */
export const POST = apiRoute(async (req: NextRequest) => {
  const ip = clientIp(req);
  if (!rateLimit("auth", `ip:${ip}`)) {
    throw new HttpError(429, "Too many attempts. Please try again later.");
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const name = String(body?.name || "").trim() || null;
  const password = String(body?.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Invalid email.");
  }
  if (password.length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters.");
  }
  if (password.length > 200) {
    throw new HttpError(400, "Password too long.");
  }
  if (name && name.length > 100) {
    throw new HttpError(400, "Name too long.");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({
    data: { email, name, passwordHash, role: "USER" },
  });

  return NextResponse.json({ ok: true });
});
