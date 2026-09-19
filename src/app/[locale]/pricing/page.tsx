import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";

// Fallback plans used if the DB is not ready yet (e.g. cold start before
// instrumentation.ts has finished initializing the schema).
const FALLBACK_PLANS = [
  {
    id: "fallback-free",
    slug: "free",
    nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }),
    description: "Try AllCombiner with a few credits. No credit card required.",
    priceMonthly: 0,
    priceYearly: 0,
    credits: 3,
    featured: false,
  },
  {
    id: "fallback-starter",
    slug: "starter",
    nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }),
    description: "For personal projects and occasional fusions.",
    priceMonthly: 9,
    priceYearly: 90,
    credits: 50,
    featured: false,
  },
  {
    id: "fallback-pro",
    slug: "pro",
    nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }),
    description: "For creators who fuse regularly. Most popular.",
    priceMonthly: 29,
    priceYearly: 290,
    credits: 250,
    featured: true,
  },
  {
    id: "fallback-business",
    slug: "business",
    nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }),
    description: "For teams and agencies that need volume.",
    priceMonthly: 99,
    priceYearly: 990,
    credits: 1000,
    featured: false,
  },
];

/**
 * Pricing page — fully DB-driven. Reads all enabled PricingPlan rows
 * sorted by sortOrder and renders them. Falls back to hardcoded defaults
 * if the DB is not ready yet (cold start).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Pricing" });

  let plans: typeof FALLBACK_PLANS = FALLBACK_PLANS;
  try {
    const dbPlans = await db.pricingPlan.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: "asc" },
    });
    if (dbPlans.length > 0) {
      plans = dbPlans.map((p) => ({
        id: p.id,
        slug: p.slug,
        nameJson: p.nameJson,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        credits: p.credits,
        featured: p.featured,
      }));
    }
  } catch (err) {
    // DB not ready yet (cold start) — use fallback plans
    console.error("[pricing] DB error, using fallback plans:", err);
  }

  function nameOf(plan: { nameJson: string }): string {
    try {
      const obj = JSON.parse(plan.nameJson) as Record<Locale, string>;
      return obj[locale as Locale] ?? obj.en ?? Object.values(obj)[0] ?? "";
    } catch {
      return plan.nameJson;
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const featured = plan.featured;
          return (
            <Card
              key={plan.id}
              className={
                featured
                  ? "glass-card border-primary/40 shadow-glow relative"
                  : "glass-card relative"
              }
            >
              {featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient text-white text-xs px-3 py-1 font-medium inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {t("mostPopular")}
                </span>
              )}
              <CardContent className="p-6 flex flex-col h-full">
                <h3 className="font-semibold text-lg">{nameOf(plan)}</h3>
                <p className="mt-1 text-xs text-muted-foreground min-h-[2.5rem]">
                  {plan.description}
                </p>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    ${plan.priceMonthly.toFixed(2)}
                  </span>
                  <span className="text-sm text-muted-foreground">{t("perMonth")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ${plan.priceYearly.toFixed(2)} {t("perYear")}
                </div>

                <div className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
                  <Check className="h-3 w-3" />
                  {plan.credits} {t("creditsPerMonth")}
                </div>

                <div className="mt-6 pt-6 border-t border-border/40">
                  <Button
                    asChild
                    size="sm"
                    className={
                      featured
                        ? "w-full bg-brand-gradient text-white hover:opacity-90"
                        : "w-full"
                    }
                    variant={featured ? "default" : "outline"}
                  >
                    <Link
                      href={localePath(locale, plan.slug === "free" ? "/signup" : "/contact")}
                    >
                      {plan.slug === "free" ? t("ctaFree") : t("cta", { plan: nameOf(plan) })}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-12 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
        {t("guarantee")}
      </div>
    </div>
  );
}

function localePath(locale: string, path: string): string {
  return `/${locale}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Pricing" });
  return { title: t("pageTitle"), description: t("pageSubtitle") };
}
