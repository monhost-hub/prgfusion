import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";

interface Plan {
  id: string;
  slug: string;
  nameJson: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  credits: number;
  featured: boolean;
  sortOrder: number;
}

// Fallback plans used if the DB is not ready yet (cold start).
const FALLBACK_PLANS: Plan[] = [
  { id: "f1", slug: "sub_free", nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }), description: "3 crédits — pour découvrir.", priceMonthly: 0, priceYearly: 0, credits: 3, featured: false, sortOrder: 0 },
  { id: "f2", slug: "sub_starter", nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }), description: "1 mois · 30 crédits — pour les curieux.", priceMonthly: 9.99, priceYearly: 9.99, credits: 30, featured: false, sortOrder: 1 },
  { id: "f3", slug: "sub_creator", nameJson: JSON.stringify({ en: "Creator", fr: "Créateur", es: "Creador" }), description: "3 mois · 100 crédits — le meilleur rapport.", priceMonthly: 24.99, priceYearly: 24.99, credits: 100, featured: true, sortOrder: 2 },
  { id: "f4", slug: "sub_pro", nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }), description: "6 mois · 250 crédits — régulier.", priceMonthly: 49.99, priceYearly: 49.99, credits: 250, featured: false, sortOrder: 3 },
  { id: "f5", slug: "sub_business", nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }), description: "12 mois · 500 crédits — équipes.", priceMonthly: 99.99, priceYearly: 99.99, credits: 500, featured: false, sortOrder: 4 },
  { id: "f6", slug: "recharge_mini", nameJson: JSON.stringify({ en: "Mini", fr: "Mini", es: "Mini" }), description: "10 crédits — tester sans engagement.", priceMonthly: 4.99, priceYearly: 4.99, credits: 10, featured: false, sortOrder: 100 },
  { id: "f7", slug: "recharge_small", nameJson: JSON.stringify({ en: "Small", fr: "Petit", es: "Pequeño" }), description: "30 crédits — petit lot.", priceMonthly: 9.99, priceYearly: 9.99, credits: 30, featured: false, sortOrder: 101 },
  { id: "f8", slug: "recharge_medium", nameJson: JSON.stringify({ en: "Medium", fr: "Moyen", es: "Mediano" }), description: "75 crédits — meilleur compromis.", priceMonthly: 19.99, priceYearly: 19.99, credits: 75, featured: true, sortOrder: 102 },
  { id: "f9", slug: "recharge_large", nameJson: JSON.stringify({ en: "Large", fr: "Grand", es: "Grande" }), description: "200 crédits — gros volumes.", priceMonthly: 39.99, priceYearly: 39.99, credits: 200, featured: false, sortOrder: 103 },
  { id: "f10", slug: "recharge_xl", nameJson: JSON.stringify({ en: "XL", fr: "XL", es: "XL" }), description: "500 crédits — le plus économique.", priceMonthly: 79.99, priceYearly: 79.99, credits: 500, featured: false, sortOrder: 104 },
];

/**
 * Pricing page — DB-driven, 2 sections:
 *  1. Abonnements (slug starts with "sub_")
 *  2. Recharges (slug starts with "recharge_")
 *
 * Falls back to hardcoded defaults if the DB is not ready (cold start).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Pricing" });

  let plans: Plan[] = FALLBACK_PLANS;
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
        sortOrder: p.sortOrder,
      }));
    }
  } catch (err) {
    console.error("[pricing] DB error, using fallback plans:", err);
  }

  const subscriptions = plans.filter((p) => p.slug.startsWith("sub_"));
  const recharges = plans.filter((p) => p.slug.startsWith("recharge_"));

  function nameOf(plan: Plan): string {
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

      {/* === SECTION 1 : ABONNEMENTS === */}
      <section className="mb-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Abonnements
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Engage-toi pour 1 à 12 mois et profite de crédits à prix réduit.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 max-w-7xl mx-auto">
          {subscriptions.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              name={nameOf(plan)}
              cta={plan.slug === "sub_free" ? t("ctaFree") : t("cta", { plan: nameOf(plan) })}
              locale={locale}
              featured={plan.featured}
            />
          ))}
        </div>
      </section>

      {/* === SECTION 2 : RECHARGES === */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            Recharges
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Achat unique, sans engagement. Plus tu prends de crédits, moins c'est cher au crédit.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 max-w-7xl mx-auto">
          {recharges.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              name={nameOf(plan)}
              cta={t("cta", { plan: nameOf(plan) })}
              locale={locale}
              featured={plan.featured}
              isRecharge
            />
          ))}
        </div>
      </section>

      <div className="mt-12 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
        {t("guarantee")}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  name,
  cta,
  locale,
  featured = false,
  isRecharge = false,
}: {
  plan: Plan;
  name: string;
  cta: string;
  locale: string;
  featured?: boolean;
  isRecharge?: boolean;
}) {
  const isFree = plan.slug === "sub_free";
  const pricePerCredit = plan.credits > 0 ? plan.priceMonthly / plan.credits : 0;

  return (
    <Card
      className={
        featured
          ? "glass-card border-primary/40 shadow-glow relative"
          : "glass-card relative"
      }
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient text-white text-xs px-3 py-1 font-medium inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Populaire
        </span>
      )}
      <CardContent className="p-5 flex flex-col h-full">
        <h3 className="font-semibold text-base">{name}</h3>
        <p className="mt-1 text-xs text-muted-foreground min-h-[2.5rem] leading-tight">
          {plan.description}
        </p>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-2xl font-bold">
            ${plan.priceMonthly.toFixed(2)}
          </span>
          {isRecharge ? (
            <span className="text-xs text-muted-foreground">une fois</span>
          ) : isFree ? (
            <span className="text-xs text-muted-foreground">pour toujours</span>
          ) : (
            <span className="text-xs text-muted-foreground">/engagement</span>
          )}
        </div>

        <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
          <Check className="h-3 w-3" />
          {plan.credits} crédits
        </div>

        {!isFree && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            ${pricePerCredit.toFixed(3)} / crédit
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-border/40">
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
            <Link href={isFree ? `/${locale}/signup` : `/${locale}/contact`}>
              {cta}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
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
