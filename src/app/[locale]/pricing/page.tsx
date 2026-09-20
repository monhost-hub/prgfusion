import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, Sparkles, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { PlanCheckoutButton } from "@/components/pricing/plan-checkout-button";

interface Plan {
  id: string;
  slug: string;
  nameJson: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  credits: number;
  featured: boolean;
  sortOrder: number;
  whopPlanId: string | null;
  whopCheckoutUrl: string | null;
  billingPeriod: string | null;
}

// Fallback plans used if the DB is not ready yet (cold start).
const FALLBACK_PLANS: Plan[] = [
  { id: "f1", slug: "sub_free", nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }), description: "3 crédits — pour découvrir.", priceMonthly: 0, priceYearly: 0, currency: "EUR", credits: 3, featured: false, sortOrder: 0, whopPlanId: null, whopCheckoutUrl: null, billingPeriod: null },
  { id: "f2", slug: "sub_starter", nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }), description: "Abonnement mensuel · 30 crédits/mois.", priceMonthly: 9.99, priceYearly: 9.99, currency: "EUR", credits: 30, featured: false, sortOrder: 1, whopPlanId: "plan_CfZL537w2pKOn", whopCheckoutUrl: "https://whop.com/checkout/plan_CfZL537w2pKOn", billingPeriod: "monthly" },
  { id: "f3", slug: "sub_creator", nameJson: JSON.stringify({ en: "Creator", fr: "Créateur", es: "Creador" }), description: "Abonnement mensuel · 100 crédits/mois.", priceMonthly: 24.99, priceYearly: 24.99, currency: "EUR", credits: 100, featured: true, sortOrder: 2, whopPlanId: "plan_ljP4MuzoKR235", whopCheckoutUrl: "https://whop.com/checkout/plan_ljP4MuzoKR235", billingPeriod: "monthly" },
  { id: "f4", slug: "sub_pro", nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }), description: "Abonnement mensuel · 250 crédits/mois.", priceMonthly: 49.99, priceYearly: 49.99, currency: "EUR", credits: 250, featured: false, sortOrder: 3, whopPlanId: "plan_iZlkOxrRs9OHY", whopCheckoutUrl: "https://whop.com/checkout/plan_iZlkOxrRs9OHY", billingPeriod: "monthly" },
  { id: "f5", slug: "sub_business", nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }), description: "Abonnement mensuel · 500 crédits/mois.", priceMonthly: 99.99, priceYearly: 99.99, currency: "EUR", credits: 500, featured: false, sortOrder: 4, whopPlanId: "plan_Gk5R2N2OViuiK", whopCheckoutUrl: "https://whop.com/checkout/plan_Gk5R2N2OViuiK", billingPeriod: "monthly" },
  { id: "f6", slug: "recharge_mini", nameJson: JSON.stringify({ en: "Mini", fr: "Mini", es: "Mini" }), description: "10 crédits — tester sans engagement.", priceMonthly: 4.99, priceYearly: 4.99, currency: "EUR", credits: 10, featured: false, sortOrder: 100, whopPlanId: "plan_p5X53jTXOIYqp", whopCheckoutUrl: "https://whop.com/checkout/plan_p5X53jTXOIYqp", billingPeriod: "one_time" },
  { id: "f7", slug: "recharge_small", nameJson: JSON.stringify({ en: "Small", fr: "Petit", es: "Pequeño" }), description: "30 crédits — petit lot.", priceMonthly: 9.99, priceYearly: 9.99, currency: "EUR", credits: 30, featured: false, sortOrder: 101, whopPlanId: "plan_K0XdfjjXukUN3", whopCheckoutUrl: "https://whop.com/checkout/plan_K0XdfjjXukUN3", billingPeriod: "one_time" },
  { id: "f8", slug: "recharge_medium", nameJson: JSON.stringify({ en: "Medium", fr: "Moyen", es: "Mediano" }), description: "75 crédits — meilleur compromis.", priceMonthly: 19.99, priceYearly: 19.99, currency: "EUR", credits: 75, featured: true, sortOrder: 102, whopPlanId: "plan_1v1cg4NMkpLfZ", whopCheckoutUrl: "https://whop.com/checkout/plan_1v1cg4NMkpLfZ", billingPeriod: "one_time" },
  { id: "f9", slug: "recharge_large", nameJson: JSON.stringify({ en: "Large", fr: "Grand", es: "Grande" }), description: "200 crédits — gros volumes.", priceMonthly: 39.99, priceYearly: 39.99, currency: "EUR", credits: 200, featured: false, sortOrder: 103, whopPlanId: "plan_ABI1GWRWr9DLV", whopCheckoutUrl: "https://whop.com/checkout/plan_ABI1GWRWr9DLV", billingPeriod: "one_time" },
  { id: "f10", slug: "recharge_xl", nameJson: JSON.stringify({ en: "XL", fr: "XL", es: "XL" }), description: "500 crédits — le plus économique.", priceMonthly: 79.99, priceYearly: 79.99, currency: "EUR", credits: 500, featured: false, sortOrder: 104, whopPlanId: "plan_6Ga9zlu7SFTdd", whopCheckoutUrl: "https://whop.com/checkout/plan_6Ga9zlu7SFTdd", billingPeriod: "one_time" },
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
        currency: p.currency,
        credits: p.credits,
        featured: p.featured,
        sortOrder: p.sortOrder,
        whopPlanId: p.whopPlanId ?? null,
        whopCheckoutUrl: p.whopCheckoutUrl ?? null,
        billingPeriod: p.billingPeriod ?? null,
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
            €{plan.priceMonthly.toFixed(2)}
          </span>
          {isRecharge ? (
            <span className="text-xs text-muted-foreground">une fois</span>
          ) : isFree ? (
            <span className="text-xs text-muted-foreground">pour toujours</span>
          ) : (
            <span className="text-xs text-muted-foreground">/mois</span>
          )}
        </div>

        <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
          <Check className="h-3 w-3" />
          {plan.credits} crédits
        </div>

        {!isFree && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            €{pricePerCredit.toFixed(3)} / crédit
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-border/40">
          {isFree ? (
            <Button
              asChild
              size="sm"
              className="w-full bg-primary/20 text-white border-2 border-primary/60 hover:bg-primary/30 hover:border-primary font-semibold shadow-sm"
              variant="outline"
            >
              <Link href={`/${locale}/signup`}>{cta}</Link>
            </Button>
          ) : plan.whopPlanId ? (
            // ✅ Plan avec Whop → checkout intégré
            <PlanCheckoutButton
              planSlug={plan.slug}
              label={cta}
              featured={featured}
              whopCheckoutUrl={plan.whopCheckoutUrl}
            />
          ) : (
            // Plan sans Whop → contact (bouton visible)
            <Button
              asChild
              size="sm"
              className={
                featured
                  ? "w-full bg-brand-gradient text-white hover:opacity-90 shadow-glow border-2 border-transparent"
                  : "w-full bg-primary/20 text-white border-2 border-primary/60 hover:bg-primary/30 hover:border-primary font-semibold shadow-sm"
              }
              variant={featured ? "default" : "outline"}
            >
              <Link href={`/${locale}/contact`}>{cta}</Link>
            </Button>
          )}
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
