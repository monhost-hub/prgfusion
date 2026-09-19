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
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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

  // Step 1: Push schema via `prisma db push` (creates tables from schema.prisma)
  // This works for both MySQL and SQLite, and stays in sync with the schema.
  try {
    // Find the schema.prisma file — it might be at ./prisma/schema.prisma
    // or in the standalone build at ./prisma/schema.prisma
    const possiblePaths = [
      resolve(process.cwd(), "prisma/schema.prisma"),
      resolve(__dirname, "../../prisma/schema.prisma"),
      resolve(__dirname, "../../../prisma/schema.prisma"),
    ];
    const schemaPath = possiblePaths.find((p) => existsSync(p));

    if (!schemaPath) {
      throw new Error("Could not find prisma/schema.prisma");
    }

    console.log(`[db-init] Pushing schema from ${schemaPath}…`);

    // Try multiple ways to invoke prisma (different in standalone vs dev)
    const commands = [
      `npx prisma db push --accept-data-loss --skip-generate --schema="${schemaPath}"`,
      `node "${resolve(process.cwd(), "node_modules/prisma/build/index.js")}" db push --accept-data-loss --skip-generate --schema="${schemaPath}"`,
      `./node_modules/.bin/prisma db push --accept-data-loss --skip-generate --schema="${schemaPath}"`,
    ];

    let pushed = false;
    for (const cmd of commands) {
      try {
        console.log(`[db-init] Trying: ${cmd.substring(0, 80)}…`);
        execSync(cmd, {
          stdio: "pipe",
          env: process.env,
          timeout: 60_000,
        });
        console.log("[db-init] ✓ Schema pushed successfully");
        pushed = true;
        break;
      } catch (err: any) {
        const msg = err.stderr?.toString() || err.message || "";
        if (msg.includes("already") || msg.includes("in sync")) {
          console.log("[db-init] ✓ Schema already in sync");
          pushed = true;
          break;
        }
        // Try next command
        continue;
      }
    }

    if (!pushed) {
      console.warn("[db-init] ⚠ Could not run prisma db push, will try seeding anyway");
    }
  } catch (err) {
    console.warn("[db-init] ⚠ Schema push failed:", err);
    // Continue anyway — seeding might still work if tables exist
  }

  // Step 2: Seed data
  const db = new PrismaClient();
  try {
    console.log("[db-init] Seeding data…");

    // 2a. Admin user
    const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@allcombiner.com").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!2024";
    const adminName = process.env.ADMIN_NAME ?? "Admin";

    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } }).catch(() => null);
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await db.user.create({
        data: { email: adminEmail, name: adminName, passwordHash, role: "ADMIN" },
      }).catch((e: any) => console.warn(`[db-init] Admin create failed: ${e.message}`));
      console.log(`[db-init] ✓ Admin created: ${adminEmail}`);
    } else if (existingAdmin.role !== "ADMIN") {
      await db.user.update({ where: { id: existingAdmin.id }, data: { role: "ADMIN" } }).catch(() => {});
      console.log(`[db-init] ✓ User promoted to admin: ${adminEmail}`);
    } else {
      console.log("[db-init] ✓ Admin already exists");
    }

    // 2b. AI models
    for (const m of DEFAULT_MODELS) {
      const existing = await db.aIModel.findFirst({ where: { providerId: m.providerId } }).catch(() => null);
      if (!existing) {
        await db.aIModel.create({ data: m }).catch((e: any) => console.warn(`[db-init] Model create failed: ${e.message}`));
        console.log(`[db-init] ✓ Model created: ${m.name}`);
      }
    }

    // Ensure exactly one active model
    const activeCount = await db.aIModel.count({ where: { isActive: true } }).catch(() => 0);
    if (activeCount === 0) {
      const first = await db.aIModel.findFirst({ orderBy: { createdAt: "asc" } }).catch(() => null);
      if (first) {
        await db.aIModel.update({ where: { id: first.id }, data: { isActive: true } }).catch(() => {});
        console.log(`[db-init] ✓ Activated default model: ${first.name}`);
      }
    }

    // 2c. Pricing plans
    for (const p of DEFAULT_PLANS) {
      const existing = await db.pricingPlan.findUnique({ where: { slug: p.slug } }).catch(() => null);
      if (!existing) {
        await db.pricingPlan.create({ data: p }).catch((e: any) => console.warn(`[db-init] Plan create failed: ${e.message}`));
        console.log(`[db-init] ✓ Plan created: ${p.slug}`);
      }
    }

    // 2d. Fusion prompt
    const existingPrompt = await db.siteSettings.findUnique({ where: { key: "fusion_prompt" } }).catch(() => null);
    if (!existingPrompt) {
      await db.siteSettings.create({
        data: {
          key: "fusion_prompt",
          value: DEFAULT_PROMPT,
          description: "Central prompt sent to the AI model with the two reference images.",
        },
      }).catch((e: any) => console.warn(`[db-init] Prompt create failed: ${e.message}`));
      console.log("[db-init] ✓ Fusion prompt seeded");
    }

    console.log("[db-init] 🎉 Database initialization complete");
  } catch (err) {
    console.error("[db-init] ❌ Seeding failed:", err);
    // Don't throw — let the server start anyway
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
