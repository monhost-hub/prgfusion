import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminPricingClient } from "@/components/admin/admin-pricing-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const plans = await db.pricingPlan.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <AdminPricingClient
      plans={plans.map((p) => ({
        id: p.id,
        slug: p.slug,
        nameJson: p.nameJson,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        currency: p.currency,
        credits: p.credits,
        featured: p.featured,
        enabled: p.enabled,
        sortOrder: p.sortOrder,
      }))}
      labels={{
        title: t("pricingTitle"),
        subtitle: t("pricingSubtitle"),
        add: t("pricingAdd"),
        edit: t("pricingEdit"),
        delete: t("pricingDelete"),
        colSlug: t("pricingColSlug"),
        colName: t("pricingColName"),
        colPrice: t("pricingColPrice"),
        colCredits: t("pricingColCredits"),
        colFeatured: t("pricingColFeatured"),
        colEnabled: t("pricingColEnabled"),
        colActions: t("pricingColActions"),
        save: "Save",
        cancel: "Cancel",
      }}
    />
  );
}
