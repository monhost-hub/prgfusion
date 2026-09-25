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
import { getSession } from "@/lib/server";
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
// Phase 1: 1 free + 4 subscriptions + 8 new one_time recharges (4 offers × 2 tiers).
const FALLBACK_PLANS: Plan[] = [
  { id: "f1", slug: "sub_free", nameJson: JSON.stringify({ en: "Free", fr: "Gratuit", es: "Gratis" }), description: "3 crédits — pour découvrir.", priceMonthly: 0, priceYearly: 0, currency: "EUR", credits: 3, featured: false, sortOrder: 0, whopPlanId: null, whopCheckoutUrl: null, billingPeriod: null },
  { id: "f2", slug: "sub_starter", nameJson: JSON.stringify({ en: "Starter", fr: "Découverte", es: "Inicio" }), description: "Abonnement mensuel · 30 crédits/mois.", priceMonthly: 9.99, priceYearly: 9.99, currency: "EUR", credits: 30, featured: false, sortOrder: 1, whopPlanId: "plan_CfZL537w2pKOn", whopCheckoutUrl: "https://whop.com/checkout/plan_CfZL537w2pKOn", billingPeriod: "monthly" },
  { id: "f3", slug: "sub_creator", nameJson: JSON.stringify({ en: "Creator", fr: "Créateur", es: "Creador" }), description: "Abonnement mensuel · 100 crédits/mois.", priceMonthly: 24.99, priceYearly: 24.99, currency: "EUR", credits: 100, featured: true, sortOrder: 2, whopPlanId: "plan_ljP4MuzoKR235", whopCheckoutUrl: "https://whop.com/checkout/plan_ljP4MuzoKR235", billingPeriod: "monthly" },
  { id: "f4", slug: "sub_pro", nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }), description: "Abonnement mensuel · 250 crédits/mois.", priceMonthly: 49.99, priceYearly: 49.99, currency: "EUR", credits: 250, featured: false, sortOrder: 3, whopPlanId: "plan_iZlkOxrRs9OHY", whopCheckoutUrl: "https://whop.com/checkout/plan_iZlkOxrRs9OHY", billingPeriod: "monthly" },
  { id: "f5", slug: "sub_business", nameJson: JSON.stringify({ en: "Business", fr: "Entreprise", es: "Empresa" }), description: "Abonnement mensuel · 500 crédits/mois.", priceMonthly: 99.99, priceYearly: 99.99, currency: "EUR", credits: 500, featured: false, sortOrder: 4, whopPlanId: "plan_Gk5R2N2OViuiK", whopCheckoutUrl: "https://whop.com/checkout/plan_Gk5R2N2OViuiK", billingPeriod: "monthly" },
  // === Recharges Phase 1 — 8 plans one_time (4 offers × 2 tiers) ===
  { id: "f6", slug: "recharge_small_normal", nameJson: JSON.stringify({ en: "Essential", fr: "Essentiel", es: "Esencial" }), description: "30 crédits — tarif normal.", priceMonthly: 11.99, priceYearly: 11.99, currency: "EUR", credits: 30, featured: false, sortOrder: 100, whopPlanId: "plan_DPhvShsD3YBfX", whopCheckoutUrl: "https://whop.com/checkout/plan_DPhvShsD3YBfX", billingPeriod: "one_time" },
  { id: "f7", slug: "recharge_small_subscriber", nameJson: JSON.stringify({ en: "Essential", fr: "Essentiel", es: "Esencial" }), description: "30 crédits — tarif abonné (−25%).", priceMonthly: 8.99, priceYearly: 8.99, currency: "EUR", credits: 30, featured: false, sortOrder: 101, whopPlanId: "plan_S46OB7PUueJb6", whopCheckoutUrl: "https://whop.com/checkout/plan_S46OB7PUueJb6", billingPeriod: "one_time" },
  { id: "f8", slug: "recharge_medium_normal", nameJson: JSON.stringify({ en: "Standard", fr: "Standard", es: "Estándar" }), description: "75 crédits — tarif normal.", priceMonthly: 23.99, priceYearly: 23.99, currency: "EUR", credits: 75, featured: true, sortOrder: 102, whopPlanId: "plan_CtGtFRboRby5g", whopCheckoutUrl: "https://whop.com/checkout/plan_CtGtFRboRby5g", billingPeriod: "one_time" },
  { id: "f9", slug: "recharge_medium_subscriber", nameJson: JSON.stringify({ en: "Standard", fr: "Standard", es: "Estándar" }), description: "75 crédits — tarif abonné (−25%).", priceMonthly: 17.99, priceYearly: 17.99, currency: "EUR", credits: 75, featured: false, sortOrder: 103, whopPlanId: "plan_ArkwvItVX8gRs", whopCheckoutUrl: "https://whop.com/checkout/plan_ArkwvItVX8gRs", billingPeriod: "one_time" },
  { id: "f10", slug: "recharge_large_normal", nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }), description: "200 crédits — tarif normal.", priceMonthly: 47.99, priceYearly: 47.99, currency: "EUR", credits: 200, featured: false, sortOrder: 104, whopPlanId: "plan_15tQouA3OI2l2", whopCheckoutUrl: "https://whop.com/checkout/plan_15tQouA3OI2l2", billingPeriod: "one_time" },
  { id: "f11", slug: "recharge_large_subscriber", nameJson: JSON.stringify({ en: "Pro", fr: "Pro", es: "Pro" }), description: "200 crédits — tarif abonné (−25%).", priceMonthly: 35.99, priceYearly: 35.99, currency: "EUR", credits: 200, featured: false, sortOrder: 105, whopPlanId: "plan_rBb0iTfLMgRrb", whopCheckoutUrl: "https://whop.com/checkout/plan_rBb0iTfLMgRrb", billingPeriod: "one_time" },
  { id: "f12", slug: "recharge_xl_normal", nameJson: JSON.stringify({ en: "Max", fr: "Max", es: "Max" }), description: "500 crédits — tarif normal.", priceMonthly: 119.99, priceYearly: 119.99, currency: "EUR", credits: 500, featured: false, sortOrder: 106, whopPlanId: "plan_wCszM2Z7PjWix", whopCheckoutUrl: "https://whop.com/checkout/plan_wCszM2Z7PjWix", billingPeriod: "one_time" },
  { id: "f13", slug: "recharge_xl_subscriber", nameJson: JSON.stringify({ en: "Max", fr: "Max", es: "Max" }), description: "500 crédits — tarif abonné (−25%).", priceMonthly: 89.99, priceYearly: 89.99, currency: "EUR", credits: 500, featured: false, sortOrder: 107, whopPlanId: "plan_OUFWrPJHvUwxY", whopCheckoutUrl: "https://whop.com/checkout/plan_OUFWrPJHvUwxY", billingPeriod: "one_time" },
];

/**
 * RechargeOffer — Vue fusionnée d'une offre de recharge (normal + abonné).
 * Jamais mentionnée comme "Pack" dans l'UI — uniquement "Essentiel / Standard / Pro / Max".
 */
interface RechargeOffer {
  name: string; // "Essentiel" | "Standard" | "Pro" | "Max"
  credits: number; // 30 | 75 | 200 | 500
  normalSlug: string; // "recharge_small_normal"
  normalPrice: number; // 11.99
  subscriberSlug: string; // "recharge_small_subscriber"
  subscriberPrice: number; // 8.99
  pricePerCreditNormal: number;
  pricePerCreditSubscriber: number;
  featured: boolean;
  savings: number;
  savingsPercent: number;
}

const OFFER_META: Record<string, { nameKey: string; credits: number; featured: boolean }> = {
  small: { nameKey: "rechargeEssential", credits: 30, featured: false },
  medium: { nameKey: "rechargeStandard", credits: 75, featured: true },
  large: { nameKey: "rechargePro", credits: 200, featured: false },
  xl: { nameKey: "rechargeMax", credits: 500, featured: false },
};

function groupRechargesIntoOffers(recharges: Plan[]): RechargeOffer[] {
  const byOffer: Record<string, { normal?: Plan; subscriber?: Plan }> = {};

  for (const r of recharges) {
    const parts = r.slug.split("_");
    if (parts.length < 3 || parts[0] !== "recharge") continue;
    const offer = parts[1];
    const tier = parts.slice(2).join("_");

    if (!byOffer[offer]) byOffer[offer] = {};
    if (tier === "normal") byOffer[offer].normal = r;
    else if (tier === "subscriber") byOffer[offer].subscriber = r;
  }

  const offers: RechargeOffer[] = [];
  for (const [offerKey, tiers] of Object.entries(byOffer)) {
    const normal = tiers.normal;
    const subscriber = tiers.subscriber;
    if (!normal || !subscriber) continue;

    const meta = OFFER_META[offerKey];
    if (!meta) continue;

    const normalPrice = normal.priceMonthly;
    const subscriberPrice = subscriber.priceMonthly;
    const savings = Math.round((normalPrice - subscriberPrice) * 100) / 100;
    const savingsPercent = normalPrice > 0 ? Math.round((savings / normalPrice) * 100) : 0;

    offers.push({
      name: meta.nameKey,
      credits: meta.credits,
      normalSlug: normal.slug,
      normalPrice,
      subscriberSlug: subscriber.slug,
      subscriberPrice,
      pricePerCreditNormal: meta.credits > 0 ? normalPrice / meta.credits : 0,
      pricePerCreditSubscriber: meta.credits > 0 ? subscriberPrice / meta.credits : 0,
      featured: meta.featured,
      savings,
      savingsPercent,
    });
  }

  offers.sort((a, b) => a.credits - b.credits);
  return offers;
}

/**
 * Check if the current user has an active subscription (Phase 2 — UserSubscription table).
 * Returns false for visitors and logged-in users without an active sub.
 */
async function isUserSubscriber(): Promise<boolean> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return false;
    const activeSub = await db.userSubscription.findFirst({
      where: { userId: session.user.id, status: "active" },
      select: { id: true },
    });
    return !!activeSub;
  } catch {
    // If UserSubscription table doesn't exist yet or DB is down, treat as non-subscriber
    return false;
  }
}

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
  const offers = groupRechargesIntoOffers(recharges);
  const subscriber = await isUserSubscriber();

  function nameOf(plan: Plan): string {
    try {
      const obj = JSON.parse(plan.nameJson) as Record<Locale, string>;
      return obj[locale as Locale] ?? obj.en ?? Object.values(obj)[0] ?? "";
    } catch {
      return plan.nameJson;
    }
  }

  function offerName(nameKey: string): string {
    try {
      return t(nameKey);
    } catch {
      return nameKey;
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
            {t("subscriptionsTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("subscriptionsSubtitle")}
          </p>
          <p className="mt-1 text-sm font-medium text-primary inline-flex items-center gap-1.5">
            <Crown className="h-4 w-4" />
            {t("subscriptionsUnlockRecharges")}
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
              t={t}
            />
          ))}
        </div>
      </section>

      {/* === SECTION 2 : RECHARGES (4 offres fusionnées) === */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-amber-500" />
            {t("rechargesTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("rechargesSubtitle")}
          </p>
        </div>

        {/* Bandeau marketing — adapté selon statut */}
        {subscriber ? (
          <div className="max-w-4xl mx-auto mb-8 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-5 py-4 flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md">
              <Crown className="h-5 w-5" />
            </div>
            <p className="text-sm md:text-base text-foreground leading-snug">
              <span className="font-semibold">{t("subscriberActiveBadge")}</span>{" "}
              {t("subscriberActiveMessage")}
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto mb-8 rounded-xl border-2 border-primary/30 bg-primary/5 px-5 py-4 flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm md:text-base text-foreground leading-snug">
                <span className="font-semibold">{t("nonSubscriberMessage")}</span>
              </p>
            </div>
            <Button asChild size="sm" className="!bg-brand-gradient !text-white !border-transparent hover:opacity-90 flex-shrink-0">
              <Link href={`/${locale}/pricing#subscriptions`}>{t("discoverSubscriptions")}</Link>
            </Button>
          </div>
        )}

        {/* 4 cartes fusionnées — 1 seule carte par offre, prix adapté au statut */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
          {offers.map((offer) => (
            <RechargeOfferCard
              key={offer.normalSlug}
              offer={offer}
              isSubscriber={subscriber}
              locale={locale}
              t={t}
              offerName={offerName(offer.name)}
            />
          ))}
        </div>

        {/* Légende sous les recharges */}
        <div className="mt-8 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 justify-center">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span><strong className="text-foreground">{t("legendSubscription")}</strong> — {t("legendSubscriptionDesc")}</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span><strong className="text-foreground">{t("legendRecharge")}</strong> — {t("legendRechargeDesc")}</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Crown className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <span><strong className="text-foreground">{t("legendSubscriber")}</strong> — {t("legendSubscriberDesc")}</span>
          </div>
        </div>
      </section>

      <div className="mt-12 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
        {t("guarantee")}
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
  t,
}: {
  plan: Plan;
  name: string;
  cta: string;
  locale: string;
  featured?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
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
          {t("mostPopular")}
        </span>
      )}
      <CardContent className="p-5 flex flex-col h-full">
        <h3 className={`font-bold text-lg tracking-tight ${featured ? "text-primary" : "text-foreground"}`}>
          {name}
        </h3>

        <p className="mt-1.5 text-xs text-muted-foreground min-h-[2.5rem] leading-tight">
          {plan.description}
        </p>

        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-extrabold text-foreground">
            €{plan.priceMonthly.toFixed(2)}
          </span>
          {isFree ? (
            <span className="text-xs text-muted-foreground">{t("forever")}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("perMonth")}</span>
          )}
        </div>

        <div className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium border border-primary/20">
          <Check className="h-3 w-3" />
          {isFree ? `${plan.credits} ${t("credits")}` : `${plan.credits} ${t("creditsPerMonth")}`}
        </div>

        {!isFree && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t("subCreditsExpire")}
          </p>
        )}

        {!isFree && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            €{pricePerCredit.toFixed(3)} / {t("credits")}
          </p>
        )}

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
 * RechargeOfferCard — Carte fusionnée d'une offre de recharge.
 *
 * - Non-abonné : affiche le prix normal + message "Abonnez-vous pour −25%"
 * - Abonné : affiche uniquement le prix abonné + badge "−25% tarif abonné"
 *
 * Un seul bouton par carte — le slug Whop est choisi côté serveur selon le statut.
 */
function RechargeOfferCard({
  offer,
  isSubscriber,
  locale: _locale,
  t,
  offerName,
}: {
  offer: RechargeOffer;
  isSubscriber: boolean;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  offerName: string;
}) {
  // Le slug envoyé au checkout dépend du statut :
  // - abonné → recharge_{pack}_subscriber (prix réduit)
  // - non-abonné → recharge_{pack}_normal (prix standard)
  const checkoutSlug = isSubscriber ? offer.subscriberSlug : offer.normalSlug;
  const displayPrice = isSubscriber ? offer.subscriberPrice : offer.normalPrice;
  const pricePerCredit = isSubscriber ? offer.pricePerCreditSubscriber : offer.pricePerCreditNormal;

  return (
    <Card
      className={
        offer.featured
          ? "!bg-primary/10 !border-2 !border-primary/50 !shadow-glow relative backdrop-blur-md transition-all duration-200"
          : "!bg-card !border !border-border/60 !shadow-md hover:!border-primary/30 transition-all duration-200 relative"
      }
    >
      {offer.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient text-white text-xs px-3 py-1 font-semibold inline-flex items-center gap-1 z-10 shadow-md">
          <Sparkles className="h-3 w-3" />
          {t("mostPopular")}
        </span>
      )}
      <CardContent className="p-5 flex flex-col h-full">
        {/* === Nom de l'offre === */}
        <h3
          className={`font-bold text-xl tracking-tight ${
            offer.featured ? "text-primary" : "text-foreground"
          }`}
        >
          {offerName}
        </h3>

        {/* === Crédits === */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30">
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-foreground">
              {offer.credits}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {t("credits")}
            </span>
          </div>
        </div>

        {/* === Prix (adapté au statut) === */}
        <div className="mt-4">
          {isSubscriber ? (
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500 text-white border-transparent text-[10px]">
                <Crown className="h-2.5 w-2.5" />
                {t("subscriberBadge")}
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge className="bg-muted text-muted-foreground border-border text-[10px]">
                <Tag className="h-2.5 w-2.5" />
                {t("standardPrice")}
              </Badge>
            </div>
          )}

          <div className="mt-2 flex items-baseline gap-2">
            {/* Prix barré (uniquement si abonné) */}
            {isSubscriber && (
              <span className="text-sm text-muted-foreground line-through">
                €{offer.normalPrice.toFixed(2)}
              </span>
            )}
            {/* Prix affiché */}
            <span className={`text-3xl font-extrabold ${isSubscriber ? "text-primary" : "text-foreground"}`}>
              €{displayPrice.toFixed(2)}
            </span>
          </div>

          {/* Prix par crédit */}
          <p className="mt-1 text-[10px] text-muted-foreground">
            €{pricePerCredit.toFixed(3)} / {t("credits")}
          </p>
        </div>

        {/* === Badge expiration (sans expiration = avantage clé) === */}
        <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 text-xs font-medium border border-emerald-500/20">
          <InfinityIcon className="h-3 w-3" />
          {t("noExpiration")}
        </div>

        {/* === CTA : un seul bouton, slug adapté au statut === */}
        <div className="mt-auto pt-4">
          {isSubscriber ? (
            <PlanCheckoutButton
              planSlug={checkoutSlug}
              label={t("buyNow")}
              featured={offer.featured}
            />
          ) : (
            <PlanCheckoutButton
              planSlug={checkoutSlug}
              label={t("buyNow")}
              featured={offer.featured}
            />
          )}
        </div>

        {/* === Message marketing (uniquement non-abonné) === */}
        {!isSubscriber && (
          <div className="mt-3 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-[11px] text-center text-primary font-medium inline-flex items-center justify-center gap-1.5">
            <TrendingDown className="h-3 w-3" />
            {t("saveWithSubscription", { amount: offer.savings.toFixed(2), percent: offer.savingsPercent })}
          </div>
        )}
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
