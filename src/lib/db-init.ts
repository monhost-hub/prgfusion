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
    description: "Le plus rapide. Idéal pour les aperçus et brouillons. ~9s par fusion.",
    costPerCall: 0.02,
    creditCost: 1, // ← 1 crédit par fusion
    enabled: 1,
    isActive: 1, // ← modèle par défaut sélectionné dans l'UI
  },
  {
    name: "Nano Banana 2",
    providerId: "google/gemini-3.1-flash-image-preview",
    provider: "openrouter",
    description: "Qualité équilibrée pour un usage quotidien. ~9s par fusion.",
    costPerCall: 0.067,
    creditCost: 2, // ← 2 crédits par fusion
    enabled: 1,
    isActive: 0,
  },
  {
    name: "Nano Banana Pro",
    providerId: "google/gemini-3.1-flash-image-preview",
    provider: "openrouter",
    description: "Fidélité maximale. Idéal pour portraits, tirages, livraison finale.",
    costPerCall: 0.12,
    creditCost: 3, // ← 3 crédits par fusion
    enabled: 1,
    isActive: 0,
  },
];

const DEFAULT_PLANS = [
  // === ABONNEMENTS (sub_*) ===
  // Les 4 plans Whop sont associés à leur Plan ID via env vars.
  // L'admin peut les modifier depuis /admin/payments sans redéployer.
  {
    slug: "sub_free",
    nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }),
    description: "3 crédits offerts à l'inscription. Aucune carte requise.",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "EUR",
    credits: 3,
    featured: 0,
    enabled: 1,
    sortOrder: 0,
    whopPlanId: null,
    whopCheckoutUrl: null,
    billingPeriod: null,
  },
  {
    slug: "sub_starter",
    nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }),
    description: "Abonnement mensuel · 30 crédits/mois — pour les curieux.",
    priceMonthly: 9.99,
    priceYearly: 9.99,
    currency: "EUR",
    credits: 30,
    featured: 0,
    enabled: 1,
    sortOrder: 1,
    whopPlanId: process.env.WHOP_STARTER_PLAN_ID || "plan_CfZL537w2pKOn",
    whopCheckoutUrl: `https://whop.com/checkout/${process.env.WHOP_STARTER_PLAN_ID || "plan_CfZL537w2pKOn"}`,
    billingPeriod: "monthly",
  },
  {
    slug: "sub_creator",
    nameJson: JSON.stringify({ en: "Creator", fr: "Créateur", es: "Creador" }),
    description: "Abonnement mensuel · 100 crédits/mois — le meilleur rapport qualité/prix.",
    priceMonthly: 24.99,
    priceYearly: 24.99,
    currency: "EUR",
    credits: 100,
    featured: 1,
    enabled: 1,
    sortOrder: 2,
    whopPlanId: process.env.WHOP_CREATOR_PLAN_ID || "plan_ljP4MuzoKR235",
    whopCheckoutUrl: `https://whop.com/checkout/${process.env.WHOP_CREATOR_PLAN_ID || "plan_ljP4MuzoKR235"}`,
    billingPeriod: "monthly",
  },
  {
    slug: "sub_pro",
    nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }),
    description: "Abonnement mensuel · 250 crédits/mois — pour les créateurs réguliers.",
    priceMonthly: 49.99,
    priceYearly: 49.99,
    currency: "EUR",
    credits: 250,
    featured: 0,
    enabled: 1,
    sortOrder: 3,
    whopPlanId: process.env.WHOP_PRO_PLAN_ID || "plan_iZlkOxrRs9OHY",
    whopCheckoutUrl: `https://whop.com/checkout/${process.env.WHOP_PRO_PLAN_ID || "plan_iZlkOxrRs9OHY"}`,
    billingPeriod: "monthly",
  },
  {
    slug: "sub_business",
    nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }),
    description: "Abonnement mensuel · 500 crédits/mois — pour les équipes et agences.",
    priceMonthly: 99.99,
    priceYearly: 99.99,
    currency: "EUR",
    credits: 500,
    featured: 0,
    enabled: 1,
    sortOrder: 4,
    whopPlanId: process.env.WHOP_BUSINESS_PLAN_ID || "plan_Gk5R2N2OViuiK",
    whopCheckoutUrl: `https://whop.com/checkout/${process.env.WHOP_BUSINESS_PLAN_ID || "plan_Gk5R2N2OViuiK"}`,
    billingPeriod: "monthly",
  },

  // === RECHARGES (recharge_*) — achat unique via Whop, sans engagement ===
  // Les 5 recharges ont maintenant leur Plan ID Whop + Checkout URL directe.
  {
    slug: "recharge_mini",
    nameJson: JSON.stringify({ en: "Mini", fr: "Mini", es: "Mini" }),
    description: "10 crédits — pour tester sans engagement.",
    priceMonthly: 4.99,
    priceYearly: 4.99,
    currency: "EUR",
    credits: 10,
    featured: 0,
    enabled: 1,
    sortOrder: 100,
    whopPlanId: "plan_p5X53jTXOIYqp",
    whopCheckoutUrl: "https://whop.com/checkout/plan_p5X53jTXOIYqp",
    billingPeriod: "one_time",
  },
  {
    slug: "recharge_small",
    nameJson: JSON.stringify({ en: "Small", fr: "Petit", es: "Pequeño" }),
    description: "30 crédits — petit lot à l'unité.",
    priceMonthly: 9.99,
    priceYearly: 9.99,
    currency: "EUR",
    credits: 30,
    featured: 0,
    enabled: 1,
    sortOrder: 101,
    whopPlanId: "plan_K0XdfjjXukUN3",
    whopCheckoutUrl: "https://whop.com/checkout/plan_K0XdfjjXukUN3",
    billingPeriod: "one_time",
  },
  {
    slug: "recharge_medium",
    nameJson: JSON.stringify({ en: "Medium", fr: "Moyen", es: "Mediano" }),
    description: "75 crédits — le meilleur compromis pour les rechargeurs.",
    priceMonthly: 19.99,
    priceYearly: 19.99,
    currency: "EUR",
    credits: 75,
    featured: 1,
    enabled: 1,
    sortOrder: 102,
    whopPlanId: "plan_1v1cg4NMkpLfZ",
    whopCheckoutUrl: "https://whop.com/checkout/plan_1v1cg4NMkpLfZ",
    billingPeriod: "one_time",
  },
  {
    slug: "recharge_large",
    nameJson: JSON.stringify({ en: "Large", fr: "Grand", es: "Grande" }),
    description: "200 crédits — pour les gros volumes ponctuels.",
    priceMonthly: 39.99,
    priceYearly: 39.99,
    currency: "EUR",
    credits: 200,
    featured: 0,
    enabled: 1,
    sortOrder: 103,
    whopPlanId: "plan_ABI1GWRWr9DLV",
    whopCheckoutUrl: "https://whop.com/checkout/plan_ABI1GWRWr9DLV",
    billingPeriod: "one_time",
  },
  {
    slug: "recharge_xl",
    nameJson: JSON.stringify({ en: "XL", fr: "XL", es: "XL" }),
    description: "500 crédits — le plus économique au crédit près.",
    priceMonthly: 79.99,
    priceYearly: 79.99,
    currency: "EUR",
    credits: 500,
    featured: 0,
    enabled: 1,
    sortOrder: 104,
    whopPlanId: "plan_6Ga9zlu7SFTdd",
    whopCheckoutUrl: "https://whop.com/checkout/plan_6Ga9zlu7SFTdd",
    billingPeriod: "one_time",
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
    \`credits\` INT NOT NULL DEFAULT 3,
    \`emailVerified\` DATETIME(3) NULL,
    \`image\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`User_email_key\`(\`email\`),
    INDEX \`User_role_idx\`(\`role\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  // Add 'credits' column to existing User table (idempotent — fails silently if exists)
  `ALTER TABLE \`User\` ADD COLUMN IF NOT EXISTS \`credits\` INT NOT NULL DEFAULT 3`,

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
    \`creditCost\` INT NOT NULL DEFAULT 1,
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`isActive\` BOOLEAN NOT NULL DEFAULT false,
    \`supportsImages\` BOOLEAN NOT NULL DEFAULT true,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    INDEX \`AIModel_provider_idx\`(\`provider\`),
    INDEX \`AIModel_isActive_idx\`(\`isActive\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  // Add 'creditCost' column to existing AIModel table (idempotent)
  `ALTER TABLE \`AIModel\` ADD COLUMN IF NOT EXISTS \`creditCost\` INT NOT NULL DEFAULT 1`,

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
    \`creditsUsed\` INT NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`Generation_userId_idx\`(\`userId\`),
    INDEX \`Generation_status_idx\`(\`status\`),
    INDEX \`Generation_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`Generation_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE,
    CONSTRAINT \`Generation_modelId_fkey\` FOREIGN KEY (\`modelId\`) REFERENCES \`AIModel\`(\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  // Add 'creditsUsed' column to existing Generation table (idempotent)
  `ALTER TABLE \`Generation\` ADD COLUMN IF NOT EXISTS \`creditsUsed\` INT NOT NULL DEFAULT 0`,

  `CREATE TABLE IF NOT EXISTS \`CreditTransaction\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`amount\` INT NOT NULL,
    \`balance\` INT NOT NULL,
    \`reason\` VARCHAR(191) NOT NULL,
    \`reference\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`CreditTransaction_userId_idx\`(\`userId\`),
    INDEX \`CreditTransaction_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`CreditTransaction_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE
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
    \`currency\` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    \`credits\` INT NOT NULL,
    \`featured\` BOOLEAN NOT NULL DEFAULT false,
    \`enabled\` BOOLEAN NOT NULL DEFAULT true,
    \`sortOrder\` INT NOT NULL DEFAULT 0,
    \`whopPlanId\` VARCHAR(191) NULL,
    \`whopCheckoutUrl\` LONGTEXT NULL,
    \`billingPeriod\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`PricingPlan_slug_key\`(\`slug\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  // Add Whop columns to existing PricingPlan (idempotent)
  `ALTER TABLE \`PricingPlan\` ADD COLUMN IF NOT EXISTS \`whopPlanId\` VARCHAR(191) NULL`,
  `ALTER TABLE \`PricingPlan\` ADD COLUMN IF NOT EXISTS \`whopCheckoutUrl\` LONGTEXT NULL`,
  `ALTER TABLE \`PricingPlan\` ADD COLUMN IF NOT EXISTS \`billingPeriod\` VARCHAR(191) NULL`,
  // Migrate existing rows from USD to EUR
  `UPDATE \`PricingPlan\` SET \`currency\` = 'EUR' WHERE \`currency\` = 'USD' OR \`currency\` IS NULL`,

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

  // === Whop tables ===
  `CREATE TABLE IF NOT EXISTS \`WhopEvent\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`whopEventId\` VARCHAR(191) NOT NULL,
    \`eventType\` VARCHAR(191) NOT NULL,
    \`whopPaymentId\` VARCHAR(191) NULL,
    \`whopMembershipId\` VARCHAR(191) NULL,
    \`userId\` VARCHAR(191) NULL,
    \`planSlug\` VARCHAR(191) NULL,
    \`status\` VARCHAR(191) NOT NULL,
    \`creditsGranted\` INT NOT NULL DEFAULT 0,
    \`rawPayload\` LONGTEXT NOT NULL,
    \`error\` TEXT NULL,
    \`processedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`WhopEvent_whopEventId_key\`(\`whopEventId\`),
    INDEX \`WhopEvent_userId_idx\`(\`userId\`),
    INDEX \`WhopEvent_eventType_idx\`(\`eventType\`),
    INDEX \`WhopEvent_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`WhopPayment\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`whopPaymentId\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`planId\` VARCHAR(191) NOT NULL,
    \`whopEventId\` VARCHAR(191) NULL,
    \`amount\` DOUBLE NOT NULL,
    \`currency\` VARCHAR(191) NOT NULL DEFAULT 'EUR',
    \`credits\` INT NOT NULL,
    \`status\` VARCHAR(191) NOT NULL,
    \`whopMembershipId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`WhopPayment_whopPaymentId_key\`(\`whopPaymentId\`),
    INDEX \`WhopPayment_userId_idx\`(\`userId\`),
    INDEX \`WhopPayment_status_idx\`(\`status\`),
    INDEX \`WhopPayment_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`WhopPayment_planId_fkey\` FOREIGN KEY (\`planId\`) REFERENCES \`PricingPlan\`(\`id\`)
  ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`PricingPlanChange\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`planId\` VARCHAR(191) NOT NULL,
    \`adminId\` VARCHAR(191) NOT NULL,
    \`field\` VARCHAR(191) NOT NULL,
    \`oldValue\` TEXT NULL,
    \`newValue\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`PricingPlanChange_planId_idx\`(\`planId\`),
    INDEX \`PricingPlanChange_adminId_idx\`(\`adminId\`),
    INDEX \`PricingPlanChange_createdAt_idx\`(\`createdAt\`),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`PricingPlanChange_planId_fkey\` FOREIGN KEY (\`planId\`) REFERENCES \`PricingPlan\`(\`id\`) ON DELETE CASCADE
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
        data: { id, email: adminEmail, name: adminName, passwordHash, role: "ADMIN", credits: 9999, updatedAt: new Date() },
      }).catch((e: any) => console.warn(`[db-init] Admin create failed: ${e.message}`));
      console.log(`[db-init] ✓ Admin created: ${adminEmail} (credits: 9999)`);
    } else if (existingAdmin.role !== "ADMIN") {
      await db.user.update({ where: { id: existingAdmin.id }, data: { role: "ADMIN", credits: 9999, updatedAt: new Date() } }).catch(() => {});
      console.log(`[db-init] ✓ User promoted to admin: ${adminEmail} (credits: 9999)`);
    } else {
      // Ensure admin always has 9999 credits (in case it was changed)
      if (existingAdmin.credits !== 9999) {
        await db.user.update({ where: { id: existingAdmin.id }, data: { credits: 9999, updatedAt: new Date() } }).catch(() => {});
      }
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
            creditCost: m.creditCost,
            enabled: Boolean(m.enabled),
            isActive: Boolean(m.isActive),
            updatedAt: new Date(),
          },
        }).catch((e: any) => console.warn(`[db-init] Model create failed: ${e.message}`));
        console.log(`[db-init] ✓ Model created: ${m.name} (creditCost: ${m.creditCost})`);
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
            currency: p.currency || "EUR",
            credits: p.credits,
            featured: Boolean(p.featured),
            enabled: Boolean(p.enabled),
            sortOrder: p.sortOrder,
            whopPlanId: p.whopPlanId ?? null,
            whopCheckoutUrl: p.whopCheckoutUrl ?? null,
            billingPeriod: p.billingPeriod ?? null,
            updatedAt: new Date(),
          },
        }).catch((e: any) => console.warn(`[db-init] Plan create failed: ${e.message}`));
        console.log(`[db-init] ✓ Plan created: ${p.slug}${p.whopPlanId ? ` (whop: ${p.whopPlanId})` : ""}`);
      } else {
        // Update existing plan: sync ALL fields from DEFAULT_PLANS so the
        // admin can change them later via the UI, but the seed always
        // reflects the latest known configuration.
        const needsUpdate =
          (p.whopPlanId !== undefined && p.whopPlanId !== existing.whopPlanId) ||
          (p.whopCheckoutUrl !== undefined && p.whopCheckoutUrl !== existing.whopCheckoutUrl) ||
          (p.currency && existing.currency !== p.currency) ||
          (p.billingPeriod && existing.billingPeriod !== p.billingPeriod) ||
          existing.priceMonthly !== p.priceMonthly ||
          existing.credits !== p.credits ||
          existing.description !== p.description;
        if (needsUpdate) {
          await db.pricingPlan.update({
            where: { id: existing.id },
            data: {
              ...(p.whopPlanId !== undefined ? { whopPlanId: p.whopPlanId } : {}),
              ...(p.whopCheckoutUrl !== undefined ? { whopCheckoutUrl: p.whopCheckoutUrl } : {}),
              ...(p.currency ? { currency: p.currency } : {}),
              ...(p.billingPeriod ? { billingPeriod: p.billingPeriod } : {}),
              priceMonthly: p.priceMonthly,
              credits: p.credits,
              description: p.description,
              updatedAt: new Date(),
            },
          }).catch(() => {});
          console.log(`[db-init] ✓ Plan updated: ${p.slug} (synced config from seed)`);
        }
      }
    }

    // === Cleanup: disable legacy plans (without sub_/recharge_ prefix) ===
    // These are leftover from the original 4-plan grid (free/starter/pro/business).
    // They were replaced by the new slugs (sub_free/sub_starter/etc.).
    // We disable them so they don't appear in the pricing page or admin list.
    const legacySlugs = ["free", "starter", "pro", "business"];
    for (const slug of legacySlugs) {
      const legacy = await db.pricingPlan.findUnique({ where: { slug } }).catch(() => null);
      if (legacy && legacy.enabled) {
        await db.pricingPlan.update({
          where: { id: legacy.id },
          data: { enabled: false, updatedAt: new Date() },
        }).catch(() => {});
        console.log(`[db-init] ✓ Disabled legacy plan: ${slug} (replaced by sub_${slug})`);
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
