import { NextRequest, NextResponse } from "next/server";
import { apiRoute, HttpError } from "@/lib/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { db } from "@/lib/db";

/**
 * POST /api/contact
 * Body: { name, email, subject?, message }
 */
export const POST = apiRoute(async (req: NextRequest) => {
  const ip = clientIp(req);
  if (!rateLimit("contact", `ip:${ip}`)) {
    throw new HttpError(429, "Too many messages from your IP. Please try again later.");
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }

  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const subject = String(body?.subject || "").trim();
  const message = String(body?.message || "").trim();

  if (!name || name.length > 100) throw new HttpError(400, "Invalid name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Invalid email.");
  if (subject.length > 200) throw new HttpError(400, "Subject too long.");
  if (!message || message.length > 2000) throw new HttpError(400, "Invalid message.");

  await db.contactMessage.create({
    data: { name, email, subject, message, status: "new" },
  });

  return NextResponse.json({ ok: true });
});
