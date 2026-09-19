import { setRequestLocale, getTranslations } from "next-intl/server";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });
  return <AdminDashboardClient title={t("dashboardTitle")} subtitle={t("dashboardSubtitle")} labels={{
    users: t("statUsers"),
    generations: t("statGenerations"),
    successRate: t("statSuccess"),
    errors: t("statErrors"),
    activeModel: t("statActiveModel"),
    estimatedCost: t("statEstimatedCost"),
    lastGeneration: t("statLastGeneration"),
  }} />;
}
