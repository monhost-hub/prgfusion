import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Tag,
  TrendingDown,
  Clock,
  Infinity as InfinityIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
// Phase 1: 1 free + 4 subscriptions + 8 new one_time recharges (4 packs × 2 tiers).
// Old recharge slugs (recharge_mini/_small/_medium/_large/_xl) have been removed
// — their Whop plans are archived/deleted and must never be displayed.
const FALLBACK_PLANS: Plan[] = [
  { id: "f1", slug: "sub_free", nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }), description: "3 crédits — pour découvrir.", priceMonthly: 0, priceYearly: 0, currency: "EUR", credits: 3, featured: false, sortOrder: 0, whopPlanId: null, whopCheckoutUrl: null, billingPeriod: null },
  { id: "f2", slug: "sub_starter", nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }), description: "Abonnement mensuel · 30 crédits/mois.", priceMonthly: 9.99, priceYearly: 9.99, currency: "EUR", credits: 30, featured: false, sortOrder: 1, whopPlanId: "plan_CfZL537w2pKOn", whopCheckoutUrl: "https://whop.com/checkout/plan_CfZL537w2pKOn", billingPeriod: "monthly" },
  { id: "f3", slug: "sub_creator", nameJson: JSON.stringify({ en: "Creator", fr: "Créateur", es: "Creador" }), description: "Abonnement mensuel · 100 crédits/mois.", priceMonthly: 24.99, priceYearly: 24.99, currency: "EUR", credits: 100, featured: true, sortOrder: 2, whopPlanId: "plan_ljP4MuzoKR235", whopCheckoutUrl: "https://whop.com/checkout/plan_ljP4MuzoKR235", billingPeriod: "monthly" },
  { id: "f4", slug: "sub_pro", nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }), description: "Abonnement mensuel · 250 crédits/mois.", priceMonthly: 49.99, priceYearly: 49.99, currency: "EUR", credits: 250, featured: false, sortOrder: 3, whopPlanId: "plan_iZlkOxrRs9OHY", whopCheckoutUrl: "https://whop.com/checkout/plan_iZlkOxrRs9OHY", billingPeriod: "monthly" },
  { id: "f5", slug: "sub_business", nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }), description: "Abonnement mensuel · 500 crédits/mois.", priceMonthly: 99.99, priceYearly: 99.99, currency: "EUR", credits: 500, featured: false, sortOrder: 4, whopPlanId: "plan_Gk5R2N2OViuiK", whopCheckoutUrl: "https://whop.com/checkout/plan_Gk5R2N2OViuiK", billingPeriod: "monthly" },
  // === Recharges Phase 1 — 8 plans one_time (4 packs × 2 tiers) ===
  { id: "f6", slug: "recharge_small_normal", nameJson: JSON.stringify({ en: "Small", fr: "Petit", es: "Pequeño" }), description: "30 crédits — tarif normal.", priceMonthly: 11.99, priceYearly: 11.99, currency: "EUR", credits: 30, featured: false, sortOrder: 100, whopPlanId: "plan_DPhvShsD3YBfX", whopCheckoutUrl: "https://whop.com/checkout/plan_DPhvShsD3YBfX", billingPeriod: "one_time" },
  { id: "f7", slug: "recharge_small_subscriber", nameJson: JSON.stringify({ en: "Small (Subscriber)", fr: "Petit (Abonné)", es: "Pequeño (Suscriptor)" }), description: "30 crédits — tarif abonné (−25%).", priceMonthly: 8.99, priceYearly: 8.99, currency: "EUR", credits: 30, featured: false, sortOrder: 101, whopPlanId: "plan_S46OB7PUueJb6", whopCheckoutUrl: "https://whop.com/checkout/plan_S46OB7PUueJb6", billingPeriod: "one_time" },
  { id: "f8", slug: "recharge_medium_normal", nameJson: JSON.stringify({ en: "Medium", fr: "Moyen", es: "Mediano" }), description: "75 crédits — tarif normal.", priceMonthly: 23.99, priceYearly: 23.99, currency: "EUR", credits: 75, featured: true, sortOrder: 102, whopPlanId: "plan_CtGtFRboRby5g", whopCheckoutUrl: "https://whop.com/checkout/plan_CtGtFRboRby5g", billingPeriod: "one_time" },
  { id: "f9", slug: "recharge_medium_subscriber", nameJson: JSON.stringify({ en: "Medium (Subscriber)", fr: "Moyen (Abonné)", es: "Mediano (Suscriptor)" }), description: "75 crédits — tarif abonné (−25%).", priceMonthly: 17.99, priceYearly: 17.99, currency: "EUR", credits: 75, featured: false, sortOrder: 103, whopPlanId: "plan_ArkwvItVX8gRs", whopCheckoutUrl: "https://whop.com/checkout/plan_ArkwvItVX8gRs", billingPeriod: "one_time" },
  { id: "f10", slug: "recharge_large_normal", nameJson: JSON.stringify({ en: "Large", fr: "Grand", es: "Grande" }), description: "200 crédits — tarif normal.", priceMonthly: 47.99, priceYearly: 47.99, currency: "EUR", credits: 200, featured: false, sortOrder: 104, whopPlanId: "plan_15tQouA3OI2l2", whopCheckoutUrl: "https://whop.com/checkout/plan_15tQouA3OI2l2", billingPeriod: "one_time" },
  { id: "f11", slug: "recharge_large_subscriber", nameJson: JSON.stringify({ en: "Large (Subscriber)", fr: "Grand (Abonné)", es: "Grande (Suscriptor)" }), description: "200 crédits — tarif abonné (−25%).", priceMonthly: 35.99, priceYearly: 35.99, currency: "EUR", credits: 200, featured: false, sortOrder: 105, whopPlanId: "plan_rBb0iTfLMgRrb", whopCheckoutUrl: "https://whop.com/checkout/plan_rBb0iTfLMgRrb", billingPeriod: "one_time" },
  { id: "f12", slug: "recharge_xl_normal", nameJson: JSON.stringify({ en: "XL", fr: "XL", es: "XL" }), description: "500 crédits — tarif normal.", priceMonthly: 119.99, priceYearly: 119.99, currency: "EUR", credits: 500, featured: false, sortOrder: 106, whopPlanId: "plan_wCszM2Z7PjWix", whopCheckoutUrl: "https://whop.com/checkout/plan_wCszM2Z7PjWix", billingPeriod: "one_time" },
  { id: "f13", slug: "recharge_xl_subscriber", nameJson: JSON.stringify({ en: "XL (Subscriber)", fr: "XL (Abonné)", es: "XL (Suscriptor)" }), description: "500 crédits — tarif abonné (−25%).", priceMonthly: 89.99, priceYearly: 89.99, currency: "EUR", credits: 500, featured: false, sortOrder: 107, whopPlanId: "plan_OUFWrPJHvUwxY", whopCheckoutUrl: "https://whop.com/checkout/plan_OUFWrPJHvUwxY", billingPeriod: "one_time" },
];

/**
 * RechargePack — Vue fusionnée d'un pack de recharge (normal + abonné).
 */
interface RechargePack {
  name: string; // "Petit" | "Moyen" | "Grand" | "XL"
  credits: number; // 30 | 75 | 200 | 500
  normalSlug: string; // "recharge_small_normal"
  normalPrice: number; // 11.99
  normalUrl: string; // "https://whop.com/checkout/plan_DPhvShsD3YBfX"
  subscriberSlug: string; // "recharge_small_subscriber"
  subscriberPrice: number; // 8.99
  subscriberUrl: string; // "https://whop.com/checkout/plan_S46OB7PUueJb6"
  pricePerCreditNormal: number; // normalPrice / credits
  pricePerCreditSubscriber: number; // subscriberPrice / credits
  featured: boolean; // true pour Moyen (le plus populaire)
  savings: number; // montant économisé en € (normalPrice - subscriberPrice)
  savingsPercent: number; // 25
}

// Métadonnées statiques associées à chaque clé de pack (slug → infos UI).
const PACK_META: Record<string, { name: string; credits: number; featured: boolean }> = {
  small: { name: "Petit", credits: 30, featured: false },
  medium: { name: "Moyen", credits: 75, featured: true },
  large: { name: "Grand", credits: 200, featured: false },
  xl: { name: "XL", credits: 500, featured: false },
};

/**
 * groupRechargesIntoPacks — Transforme les 8 plans de recharge (4 packs × 2 tiers)
 * en 4 packs fusionnés, prêts à être affichés côte à côte.
 *
 * Le slug est attendu au format : `recharge_{pack}_{tier}`
 *   - pack : small | medium | large | xl
 *   - tier : normal | subscriber
 */
function groupRechargesIntoPacks(recharges: Plan[]): RechargePack[] {
  const byPack: Record<string, { normal?: Plan; subscriber?: Plan }> = {};

  for (const r of recharges) {
    const parts = r.slug.split("_"); // ["recharge", "small", "normal"]
    if (parts.length < 3 || parts[0] !== "recharge") continue;
    const pack = parts[1]; // "small" | "medium" | "large" | "xl"
    const tier = parts.slice(2).join("_"); // "normal" | "subscriber"

    if (!byPack[pack]) byPack[pack] = {};
    if (tier === "normal") byPack[pack].normal = r;
    else if (tier === "subscriber") byPack[pack].subscriber = r;
  }

  const packs: RechargePack[] = [];
  for (const [packKey, tiers] of Object.entries(byPack)) {
    const normal = tiers.normal;
    const subscriber = tiers.subscriber;
    if (!normal || !subscriber) continue;

    const meta = PACK_META[packKey];
    if (!meta) continue;

    const normalPrice = normal.priceMonthly;
    const subscriberPrice = subscriber.priceMonthly;
    const savings = Math.round((normalPrice - subscriberPrice) * 100) / 100;
    const savingsPercent =
      normalPrice > 0 ? Math.round((savings / normalPrice) * 100) : 0;

    packs.push({
      name: meta.name,
      credits: meta.credits,
      normalSlug: normal.slug,
      normalPrice,
      normalUrl: normal.whopCheckoutUrl ?? "",
      subscriberSlug: subscriber.slug,
      subscriberPrice,
      subscriberUrl: subscriber.whopCheckoutUrl ?? "",
      pricePerCreditNormal: meta.credits > 0 ? normalPrice / meta.credits : 0,
      pricePerCreditSubscriber: meta.credits > 0 ? subscriberPrice / meta.credits : 0,
      featured: meta.featured,
      savings,
      savingsPercent,
    });
  }

  // Tri ascendant par nombre de crédits (Petit → XL).
  packs.sort((a, b) => a.credits - b.credits);
  return packs;
}

/**
 * Pricing page — DB-driven, 3 sections:
 *  1. Abonnements (slug starts with "sub_")
 *  2. Recharges refondues — 4 packs fusionnés (normal + abonné côte à côte)
 *  3. Test $1
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
  const packs = groupRechargesIntoPacks(recharges);

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
          <p className="mt-1 text-sm font-medium text-primary inline-flex items-center gap-1.5">
            <Crown className="h-4 w-4" />
            Les abonnés débloquent les recharges à prix réduit (−25%)
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

      {/* === SECTION 2 : RECHARGES REFONDUES === */}
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

        {/* Bandeau marketing — avantage abonné */}
        <div className="max-w-4xl mx-auto mb-8 rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm md:text-base text-foreground leading-snug">
            <span className="font-semibold">Les abonnés profitent de 25% sur toutes les recharges.</span>{" "}
            Abonne-toi pour débloquer les prix réduits + des crédits sans expiration.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          {packs.map((pack) => (
            <RechargePackCard key={pack.normalSlug} pack={pack} />
          ))}
        </div>
      </section>

      <div className="mt-12 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
        {t("guarantee")}
      </div>

      {/* === SECTION 3 : TEST PAIEMENT $1 === */}
      <div className="mt-8 text-center border-t border-border/40 pt-8">
        <p className="text-xs text-muted-foreground mb-3">Test de paiement</p>
        <PlanCheckoutButton
          planSlug="test_1dollar"
          label="Test paiement 1$"
          featured={false}
        />
      </div>
    </div>
  );
}

/* ============================================================================
 * Sous-composants
 * ========================================================================= */

function PlanCard({
  plan,
  name,
  cta,
  locale,
  featured = false,
}: {
  plan: Plan;
  name: string;
  cta: string;
  locale: string;
  featured?: boolean;
}) {
  const isFree = plan.slug === "sub_free";
  const pricePerCredit = plan.credits > 0 ? plan.priceMonthly / plan.credits : 0;

  return (
    <Card
      className={
        featured
          ? "!bg-primary/10 !border-2 !border-primary/50 !shadow-glow relative backdrop-blur-md"
          : "!bg-card !border !border-border/60 !shadow-md hover:!border-primary/30 transition-all duration-200 relative"
      }
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient text-white text-xs px-3 py-1 font-semibold inline-flex items-center gap-1 z-10 shadow-md">
          <Sparkles className="h-3 w-3" />
          Populaire
        </span>
      )}
      <CardContent className="p-5 flex flex-col h-full">
        {/* === Titre du plan === */}
        <h3 className={`font-bold text-lg tracking-tight ${featured ? "text-primary" : "text-foreground"}`}>
          {name}
        </h3>

        {/* === Description courte === */}
        <p className="mt-1.5 text-xs text-muted-foreground min-h-[2.5rem] leading-tight">
          {plan.description}
        </p>

        {/* === Prix === */}
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-foreground">
            €{plan.priceMonthly.toFixed(2)}
          </span>
          {isFree ? (
            <span className="text-xs text-muted-foreground">pour toujours</span>
          ) : (
            <span className="text-xs text-muted-foreground">/mois</span>
          )}
        </div>

        {/* === Nombre de crédits === */}
        <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium border border-primary/20">
          <Check className="h-3 w-3" />
          {isFree ? `${plan.credits} crédits` : `${plan.credits} crédits/mois`}
        </div>

        {/* === Mention expiration === */}
        {!isFree && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            expirent en 30 jours
          </p>
        )}

        {/* === Prix par crédit === */}
        {!isFree && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            €{pricePerCredit.toFixed(3)} / crédit
          </p>
        )}

        {/* === CTA === */}
        <div className="mt-4 pt-4 border-t border-border/40">
          {isFree ? (
            <Button
              asChild
              size="sm"
              className="w-full !bg-primary/25 !text-white !border-2 !border-primary hover:!bg-primary/40 hover:!border-primary font-semibold shadow-sm"
              variant="outline"
            >
              <Link href={`/${locale}/signup`}>{cta}</Link>
            </Button>
          ) : plan.whopPlanId ? (
            <PlanCheckoutButton
              planSlug={plan.slug}
              label={cta}
              featured={featured}
            />
          ) : (
            <Button
              asChild
              size="sm"
              className={
                featured
                  ? "w-full !bg-brand-gradient !text-white !border-2 !border-transparent hover:opacity-90 shadow-glow"
                  : "w-full !bg-primary/25 !text-white !border-2 !border-primary hover:!bg-primary/40 hover:!border-primary font-semibold shadow-sm"
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

/**
 * RechargePackCard — Carte fusionnée d'un pack de recharge.
 *
 * Affiche côte à côte le tarif normal (visiteur) et le tarif abonné (−25%),
 * avec un bouton d'achat par variante. Le client choisit selon son statut.
 */
function RechargePackCard({ pack }: { pack: RechargePack }) {
  return (
    <Card
      className={
        pack.featured
          ? "!bg-primary/10 !border-2 !border-primary/50 !shadow-glow relative backdrop-blur-md transition-all duration-200"
          : "!bg-card !border !border-border/60 !shadow-md hover:!border-primary/30 transition-all duration-200 relative"
      }
    >
      {pack.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient text-white text-xs px-3 py-1 font-semibold inline-flex items-center gap-1 z-10 shadow-md">
          <Sparkles className="h-3 w-3" />
          Populaire
        </span>
      )}
      <CardContent className="p-5 flex flex-col h-full">
        {/* === En-tête : nom du pack + badges === */}
        <div className="flex items-center justify-between gap-2">
          <h3
            className={`font-bold text-xl tracking-tight ${
              pack.featured ? "text-primary" : "text-foreground"
            }`}
          >
            Pack {pack.name}
          </h3>
          {pack.featured && (
            <Badge className="bg-brand-gradient text-white border-transparent">
              <Sparkles className="h-3 w-3" />
              Populaire
            </Badge>
          )}
        </div>

        {/* === Crédits — gros chiffre === */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30">
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-foreground">
              {pack.credits}
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              crédits
            </span>
          </div>
        </div>

        {/* === Double prix : Normal (gauche) + Abonné (droite) === */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* --- Bloc Normal --- */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Tag className="h-3 w-3" />
              Normal
            </div>
            <div className="mt-1.5 text-2xl font-extrabold text-foreground leading-none">
              €{pack.normalPrice.toFixed(2)}
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <InfinityIcon className="h-3 w-3 text-emerald-500" />
              Sans expiration
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              €{pack.pricePerCreditNormal.toFixed(3)} / crédit
            </div>
            <div className="mt-auto pt-3">
              <PlanCheckoutButton
                planSlug={pack.normalSlug}
                label="Acheter"
                featured={false}
              />
            </div>
          </div>

          {/* --- Bloc Abonné (mis en avant) --- */}
          <div className="rounded-lg border-2 border-primary/50 bg-primary/10 p-3 flex flex-col relative">
            <div className="absolute -top-2.5 right-2">
              <Badge className="bg-brand-gradient text-white border-transparent text-[10px] px-2 py-0.5 shadow-md">
                <TrendingDown className="h-2.5 w-2.5" />
                −{pack.savingsPercent}%
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Crown className="h-3 w-3" />
              Abonné
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5 leading-none">
              <span className="text-xs text-muted-foreground line-through">
                €{pack.normalPrice.toFixed(2)}
              </span>
              <span className="text-2xl font-extrabold text-primary">
                €{pack.subscriberPrice.toFixed(2)}
              </span>
            </div>
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Expire en 30 jours
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              €{pack.pricePerCreditSubscriber.toFixed(3)} / crédit
            </div>
            <div className="mt-auto pt-3">
              <PlanCheckoutButton
                planSlug={pack.subscriberSlug}
                label="Acheter (abonné)"
                featured={true}
              />
            </div>
          </div>
        </div>

        {/* === Message marketing : économie réalisée === */}
        <div className="mt-4 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-center text-primary font-medium inline-flex items-center justify-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5" />
          Abonne-toi et économise €{pack.savings.toFixed(2)} sur ce pack
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
