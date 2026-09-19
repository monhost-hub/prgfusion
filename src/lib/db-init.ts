/**
 * Runtime database initialization.
 *
 * This module ensures the database schema is pushed and the seed data exists
 * when the Next.js server starts. It runs ONCE per process (memoized).
 *
 * Why this exists:
 * - Hostinger runs `npm run build` in a sandbox without env vars
 * - `prisma db push` during build therefore fails silently
 * - We need to init the DB at RUNTIME (when env vars are available)
 * - This module is imported from instrumentation.ts which Next.js calls
 *   once when the server boots.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

let initPromise: Promise<void> | null = null;

const DEFAULT_PROMPT = `You are a portrait photographer AI. You will receive TWO reference photographs of TWO DIFFERENT people.

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

const DEFAULT_MODELS = [
  {
    name: "Nano Banana 2 Lite",
    providerId: "google/nano-banana-2-lite",
    provider: "openrouter",
    description: "Fastest tier — ideal for previews and quick drafts.",
    costPerCall: 0.02,
    enabled: true,
    isActive: true,
  },
  {
    name: "Nano Banana 2",
    providerId: "google/nano-banana-2",
    provider: "openrouter",
    description: "Balanced quality and speed for everyday fusion.",
    costPerCall: 0.05,
    enabled: true,
    isActive: false,
  },
  {
    name: "Nano Banana Pro",
    providerId: "google/nano-banana-pro",
    provider: "openrouter",
    description: "Highest fidelity — best for portraits, prints, final delivery.",
    costPerCall: 0.12,
    enabled: true,
    isActive: false,
  },
];

const DEFAULT_PLANS = [
  {
    slug: "free",
    nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }),
    description: "Try AllCombiner with a few credits. No credit card required.",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "USD",
    credits: 3,
    featured: false,
    enabled: true,
    sortOrder: 0,
  },
  {
    slug: "starter",
    nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }),
    description: "For personal projects and occasional fusions.",
    priceMonthly: 9,
    priceYearly: 90,
    currency: "USD",
    credits: 50,
    featured: false,
    enabled: true,
    sortOrder: 1,
  },
  {
    slug: "pro",
    nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }),
    description: "For creators who fuse regularly. Most popular.",
    priceMonthly: 29,
    priceYearly: 290,
    currency: "USD",
    credits: 250,
    featured: true,
    enabled: true,
    sortOrder: 2,
  },
  {
    slug: "business",
    nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }),
    description: "For teams and agencies that need volume.",
    priceMonthly: 99,
    priceYearly: 990,
    currency: "USD",
    credits: 1000,
    featured: false,
    enabled: true,
    sortOrder: 3,
  },
];

async function doInit(): Promise<void> {
  if (process.env.SKIP_DB_INIT === "true") return;

  console.log("[db-init] Starting runtime database initialization…");

  // Use a fresh Prisma client (don't reuse the singleton — we want to be
  // 100% sure this is a separate connection that we can close cleanly).
  const db = new PrismaClient();

  try {
    // 1. Push schema via raw SQL for SQLite (creates tables if missing)
    // For SQLite we can create tables with raw SQL. This is idempotent.
    console.log("[db-init] Creating tables if missing…");

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'USER',
      "emailVerified" DATETIME,
      "image" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "providerAccountId" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "Session" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionToken" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "expires" DATETIME NOT NULL,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "VerificationToken" (
      "identifier" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "expires" DATETIME NOT NULL
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token")`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "AIModel" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "provider" TEXT NOT NULL DEFAULT 'openrouter',
      "description" TEXT,
      "costPerCall" REAL NOT NULL DEFAULT 0,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "supportsImages" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "AIModel_provider_idx" ON "AIModel"("provider")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "AIModel_isActive_idx" ON "AIModel"("isActive")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "Generation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "modelId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "prompt" TEXT NOT NULL,
      "inputAPath" TEXT NOT NULL,
      "inputBPath" TEXT NOT NULL,
      "outputPath" TEXT,
      "durationMs" INTEGER,
      "error" TEXT,
      "estimatedCost" REAL NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      FOREIGN KEY ("modelId") REFERENCES "AIModel"("id")
    )`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Generation_userId_idx" ON "Generation"("userId")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Generation_status_idx" ON "Generation"("status")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "Generation_createdAt_idx" ON "Generation"("createdAt")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "SiteSettings" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "description" TEXT,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "SiteSettings_key_key" ON "SiteSettings"("key")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "PricingPlan" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "slug" TEXT NOT NULL,
      "nameJson" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "priceMonthly" REAL NOT NULL,
      "priceYearly" REAL NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "credits" INTEGER NOT NULL,
      "featured" BOOLEAN NOT NULL DEFAULT false,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    await db.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "PricingPlan_slug_key" ON "PricingPlan"("slug")`;

    await db.$executeRaw`CREATE TABLE IF NOT EXISTS "ContactMessage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "subject" TEXT,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'new',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "ContactMessage_status_idx" ON "ContactMessage"("status")`;
    await db.$executeRaw`CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt")`;

    console.log("[db-init] ✓ Tables ready");

    // 2. Seed admin user
    const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@allcombiner.com").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!2024";
    const adminName = process.env.ADMIN_NAME ?? "Admin";

    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await db.user.create({
        data: { email: adminEmail, name: adminName, passwordHash, role: "ADMIN" },
      });
      console.log(`[db-init] ✓ Admin created: ${adminEmail}`);
    } else if (existingAdmin.role !== "ADMIN") {
      // Promote to admin if exists but not admin
      await db.user.update({ where: { id: existingAdmin.id }, data: { role: "ADMIN" } });
      console.log(`[db-init] ✓ User promoted to admin: ${adminEmail}`);
    } else {
      console.log("[db-init] ✓ Admin already exists");
    }

    // 3. Seed AI models
    for (const m of DEFAULT_MODELS) {
      const existing = await db.aIModel.findFirst({ where: { providerId: m.providerId } });
      if (!existing) {
        await db.aIModel.create({ data: m });
        console.log(`[db-init] ✓ Model created: ${m.name}`);
      }
    }
    // Ensure exactly one active model
    const activeCount = await db.aIModel.count({ where: { isActive: true } });
    if (activeCount === 0) {
      const first = await db.aIModel.findFirst({ orderBy: { createdAt: "asc" } });
      if (first) {
        await db.aIModel.update({ where: { id: first.id }, data: { isActive: true } });
        console.log(`[db-init] ✓ Activated default model: ${first.name}`);
      }
    }

    // 4. Seed pricing plans
    for (const p of DEFAULT_PLANS) {
      const existing = await db.pricingPlan.findUnique({ where: { slug: p.slug } });
      if (!existing) {
        await db.pricingPlan.create({ data: p });
        console.log(`[db-init] ✓ Plan created: ${p.slug}`);
      }
    }

    // 5. Seed fusion prompt
    const existingPrompt = await db.siteSettings.findUnique({ where: { key: "fusion_prompt" } });
    if (!existingPrompt) {
      await db.siteSettings.create({
        data: {
          key: "fusion_prompt",
          value: DEFAULT_PROMPT,
          description: "Central prompt sent to the AI model with the two reference images.",
        },
      });
      console.log("[db-init] ✓ Fusion prompt seeded");
    }

    console.log("[db-init] 🎉 Database initialization complete");
  } catch (err) {
    console.error("[db-init] ❌ Initialization failed:", err);
    // Don't throw — let the server start anyway so admin can debug via UI
  } finally {
    await db.$disconnect();
  }
}

export function ensureDbInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}
