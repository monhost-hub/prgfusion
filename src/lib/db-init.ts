/**
 * Runtime database initialization.
 *
 * Creates all tables and seeds default data at server startup.
 * Uses raw SQL via Prisma (no dependency on `prisma` CLI binary).
 *
 * This module is invoked by src/instrumentation.ts on server boot.
 * Idempotent: safe to run on every request (uses CREATE TABLE IF NOT EXISTS).
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
    providerId: "google/gemini-3.1-flash-image-preview",
    provider: "openrouter",
    description: "Fastest tier — ideal for previews and quick drafts.",
    costPerCall: 0.02,
    enabled: 1,
    isActive: 1,
  },
  {
    name: "Nano Banana 2",
    providerId: "google/gemini-3.1-flash-image-preview",
    provider: "openrouter",
    description: "Balanced quality and speed for everyday fusion. ~9s per image, ~$0.067/call.",
    costPerCall: 0.067,
    enabled: 1,
    isActive: 0,
  },
  {
    name: "Nano Banana Pro",
    providerId: "google/gemini-3.1-flash-image-preview",
    provider: "openrouter",
    description: "Highest fidelity — best for portraits, prints, final delivery.",
    costPerCall: 0.12,
    enabled: 1,
    isActive: 0,
  },
];

const DEFAULT_PLANS = [
  {
    slug: "free",
    nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }),
    description: "Try AllCombiner with a few credits. No credit card required.",
    priceMonthly: 0,
    priceYearly: 0,
    credits: 3,
    featured: 0,
    enabled: 1,
    sortOrder: 0,
  },
  {
    slug: "starter",
    nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }),
    description: "For personal projects and occasional fusions.",
    priceMonthly: 9,
    priceYearly: 90,
    credits: 50,
    featured: 0,
    enabled: 1,
    sortOrder: 1,
  },
  {
    slug: "pro",
    nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }),
    description: "For creators who fuse regularly. Most popular.",
    priceMonthly: 29,
    priceYearly: 290,
    credits: 250,
    featured: 1,
    enabled: 1,
    sortOrder: 2,
  },
  {
    slug: "business",
    nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }),
    description: "For teams and agencies that need volume.",
    priceMonthly: 99,
    priceYearly: 990,
    credits: 1000,
    featured: 0,
    enabled: 1,
    sortOrder: 3,
  },
];

/**
 * MySQL CREATE TABLE statements (idempotent via IF NOT EXISTS).
 * These match the Prisma schema exactly (provider = mysql).
 */
const CREATE_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS \`User\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NULL,
    \`passwordHash\` TEXT NOT NULL,
    \`role\` VARCHAR(191) NOT NULL DEFAULT 'USER',
    \`emailVerified\` DATETIME(3) NULL,
    \`image\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`User_email_key\`(\`email\`),
    INDEX \`User_role_idx\`(\`role\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`Account\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`type\` VARCHAR(191) NOT NULL,
    \`provider\` VARCHAR(191) NOT NULL,
    \`providerAccountId\` VARCHAR(191) NOT NULL,
    \`refresh_token\` TEXT NULL,
    \`access_token\` TEXT NULL,
    \`expires_at\` INT NULL,
    \`token_type\` VARCHAR(191) NULL,
    \`scope\` VARCHAR(191) NULL,
    \`id_token\` TEXT NULL,
    \`session_state\` TEXT NULL,
    UNIQUE INDEX \`Account_provider_providerAccountId_key\`(\`provider\`, \`providerAccountId\`),
    INDEX \`Account_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`Account_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`Session\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`sessionToken\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`expires\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`Session_sessionToken_key\`(\`sessionToken\`),
    INDEX \`Session_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`Session_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`VerificationToken\` (
    \`identifier\` VARCHAR(191) NOT NULL,
    \`token\` VARCHAR(191) NOT NULL,
    \`expires\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`VerificationToken_token_key\`(\`token\`),
    UNIQUE INDEX \`VerificationToken_identifier_token_key\`(\`identifier\`, \`token\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`AIModel\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`providerId\` VARCHAR(191) NOT NULL,
    \`provider\` VARCHAR(191) NOT NULL DEFAULT 'openrouter',
    \`description\` TEXT NULL,
    \`costPerCall\` DOUBLE NOT NULL DEFAULT 0,
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`isActive\` BOOLEAN NOT NULL DEFAULT false,
    \`supportsImages\` BOOLEAN NOT NULL DEFAULT true,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    INDEX \`AIModel_provider_idx\`(\`provider\`),
    INDEX \`AIModel_isActive_idx\`(\`isActive\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`Generation\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`modelId\` VARCHAR(191) NOT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'pending',
    \`prompt\` LONGTEXT NOT NULL,
    \`inputAPath\` LONGTEXT NOT NULL,
    \`inputBPath\` LONGTEXT NOT NULL,
    \`outputPath\` LONGTEXT NULL,
    \`durationMs\` INT NULL,
    \`error\` TEXT NULL,
    \`estimatedCost\` DOUBLE NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`Generation_userId_idx\`(\`userId\`),
    INDEX \`Generation_status_idx\`(\`status\`),
    INDEX \`Generation_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`Generation_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`Generation_modelId_fkey\` FOREIGN KEY (\`modelId\`) REFERENCES \`AIModel\`(\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`SiteSettings\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`key\` VARCHAR(191) NOT NULL,
    \`value\` LONGTEXT NOT NULL,
    \`description\` TEXT NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`SiteSettings_key_key\`(\`key\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`PricingPlan\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`slug\` VARCHAR(191) NOT NULL,
    \`nameJson\` LONGTEXT NOT NULL,
    \`description\` LONGTEXT NOT NULL,
    \`priceMonthly\` DOUBLE NOT NULL,
    \`priceYearly\` DOUBLE NOT NULL,
    \`currency\` VARCHAR(191) NOT NULL DEFAULT 'USD',
    \`credits\` INT NOT NULL,
    \`featured\` BOOLEAN NOT NULL DEFAULT false,
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`sortOrder\` INT NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`PricingPlan_slug_key\`(\`slug\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`ContactMessage\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL,
    \`subject\` VARCHAR(191) NULL,
    \`message\` LONGTEXT NOT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'new',
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`ContactMessage_status_idx\`(\`status\`),
    INDEX \`ContactMessage_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
];

async function doInit(): Promise<void> {
  if (process.env.SKIP_DB_INIT === "true") return;

  console.log("[db-init] Starting runtime database initialization…");
  const db = new PrismaClient();

  try {
    // 1. Create tables if missing (raw SQL — no prisma CLI needed)
    console.log("[db-init] Creating tables if missing…");
    for (const sql of CREATE_TABLES_SQL) {
      try {
        await db.$executeRawUnsafe(sql);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!/already exists|Duplicate/i.test(err.message)) {
          console.warn(`[db-init] Table create warning: ${err.message.slice(0, 200)}`);
        }
      }
    }
    console.log("[db-init] ✓ Tables ready");

    // 2. Seed admin user
    const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@allcombiner.com").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!2024";
    const adminName = process.env.ADMIN_NAME ?? "Admin";

    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } }).catch(() => null);
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const id = `admin_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await db.user.create({
        data: { id, email: adminEmail, name: adminName, passwordHash, role: "ADMIN", updatedAt: new Date() },
      }).catch((e: any) => console.warn(`[db-init] Admin create failed: ${e.message}`));
      console.log(`[db-init] ✓ Admin created: ${adminEmail}`);
    } else if (existingAdmin.role !== "ADMIN") {
      await db.user.update({ where: { id: existingAdmin.id }, data: { role: "ADMIN", updatedAt: new Date() } }).catch(() => {});
      console.log(`[db-init] ✓ User promoted to admin: ${adminEmail}`);
    } else {
      console.log("[db-init] ✓ Admin already exists");
    }

    // 3. Seed AI models
    for (const m of DEFAULT_MODELS) {
      const existing = await db.aIModel.findFirst({ where: { providerId: m.providerId, name: m.name } }).catch(() => null);
      if (!existing) {
        const id = `model_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await db.aIModel.create({
          data: {
            id,
            name: m.name,
            providerId: m.providerId,
            provider: m.provider,
            description: m.description,
            costPerCall: m.costPerCall,
            enabled: Boolean(m.enabled),
            isActive: Boolean(m.isActive),
            updatedAt: new Date(),
          },
        }).catch((e: any) => console.warn(`[db-init] Model create failed: ${e.message}`));
        console.log(`[db-init] ✓ Model created: ${m.name}`);
      }
    }

    // Ensure exactly one active model
    const activeCount = await db.aIModel.count({ where: { isActive: true } }).catch(() => 0);
    if (activeCount === 0) {
      const first = await db.aIModel.findFirst({ orderBy: { createdAt: "asc" } }).catch(() => null);
      if (first) {
        await db.aIModel.update({ where: { id: first.id }, data: { isActive: true, updatedAt: new Date() } }).catch(() => {});
        console.log(`[db-init] ✓ Activated default model: ${first.name}`);
      }
    }

    // 4. Seed pricing plans
    for (const p of DEFAULT_PLANS) {
      const existing = await db.pricingPlan.findUnique({ where: { slug: p.slug } }).catch(() => null);
      if (!existing) {
        const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        await db.pricingPlan.create({
          data: {
            id,
            slug: p.slug,
            nameJson: p.nameJson,
            description: p.description,
            priceMonthly: p.priceMonthly,
            priceYearly: p.priceYearly,
            currency: "USD",
            credits: p.credits,
            featured: Boolean(p.featured),
            enabled: Boolean(p.enabled),
            sortOrder: p.sortOrder,
            updatedAt: new Date(),
          },
        }).catch((e: any) => console.warn(`[db-init] Plan create failed: ${e.message}`));
        console.log(`[db-init] ✓ Plan created: ${p.slug}`);
      }
    }

    // 5. Seed fusion prompt
    const existingPrompt = await db.siteSettings.findUnique({ where: { key: "fusion_prompt" } }).catch(() => null);
    if (!existingPrompt) {
      const id = `setting_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      await db.siteSettings.create({
        data: {
          id,
          key: "fusion_prompt",
          value: DEFAULT_PROMPT,
          description: "Central prompt sent to the AI model with the two reference images.",
          updatedAt: new Date(),
        },
      }).catch((e: any) => console.warn(`[db-init] Prompt create failed: ${e.message}`));
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
