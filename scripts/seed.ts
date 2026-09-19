/**
 * Database seed script.
 *
 * Usage: `bun run db:seed`
 *
 * Idempotent: safe to run multiple times.
 *
 * Creates:
 * - The initial admin user (from env vars ADMIN_EMAIL / ADMIN_PASSWORD)
 * - Three AI models (Nano Banana 2 Lite / 2 / Pro) — first one active
 * - Four pricing plans (Free / Starter / Pro / Business)
 * - The central fusion prompt in SiteSettings
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ---------------------------------------------------------------- admin
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@allcombiner.com").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!2024";
  const adminName = process.env.ADMIN_NAME ?? "Admin";

  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log(`  ↳ admin already exists (${adminEmail}) — skipping creation`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.user.create({
      data: { email: adminEmail, name: adminName, passwordHash, role: "ADMIN" },
    });
    console.log(`  ↳ admin created: ${adminEmail} / ${adminPassword}`);
  }

  // ---------------------------------------------------------------- models
  // NOTE: The providerId values below are the official OpenRouter model ids
  // for the Nano Banana family. They are configurable from the admin UI; if
  // OpenRouter renames a model, just edit it in Admin → AI Models — no code
  // change required.
  const defaultModels = [
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

  for (const m of defaultModels) {
    const existing = await db.aIModel.findFirst({ where: { providerId: m.providerId } });
    if (existing) {
      console.log(`  ↳ model already exists: ${m.name} (${m.providerId})`);
      continue;
    }
    await db.aIModel.create({ data: m });
    console.log(`  ↳ model created: ${m.name} (${m.providerId}) active=${m.isActive}`);
  }

  // Ensure exactly one model is active
  const activeCount = await db.aIModel.count({ where: { isActive: true } });
  if (activeCount === 0) {
    const first = await db.aIModel.findFirst({ orderBy: { createdAt: "asc" } });
    if (first) {
      await db.aIModel.update({ where: { id: first.id }, data: { isActive: true } });
      console.log(`  ↳ activated default model: ${first.name}`);
    }
  } else if (activeCount > 1) {
    // Reset and pick the first one
    const all = await db.aIModel.findMany({ orderBy: { createdAt: "asc" } });
    await db.aIModel.updateMany({ data: { isActive: false } });
    await db.aIModel.update({ where: { id: all[0].id }, data: { isActive: true } });
    console.log(`  ↳ reset to single active model: ${all[0].name}`);
  }

  // ---------------------------------------------------------------- pricing
  const defaultPlans = [
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

  for (const p of defaultPlans) {
    const existing = await db.pricingPlan.findUnique({ where: { slug: p.slug } });
    if (existing) {
      console.log(`  ↳ plan already exists: ${p.slug}`);
      continue;
    }
    await db.pricingPlan.create({ data: p });
    console.log(`  ↳ plan created: ${p.slug}`);
  }

  // ---------------------------------------------------------------- prompt
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

  const existingPrompt = await db.siteSettings.findUnique({ where: { key: "fusion_prompt" } });
  if (existingPrompt) {
    console.log("  ↳ fusion_prompt already set — skipping");
  } else {
    await db.siteSettings.create({
      data: {
        key: "fusion_prompt",
        value: DEFAULT_PROMPT,
        description: "Central prompt sent to the AI model with the two reference images.",
      },
    });
    console.log("  ↳ fusion_prompt seeded");
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
