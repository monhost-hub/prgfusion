import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminSiteSettingsClient } from "@/components/admin/admin-site-settings-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const settings = await db.siteSettings.findMany({ orderBy: { key: "asc" } });

  return (
    <AdminSiteSettingsClient
      settings={settings.map((s) => ({ id: s.id, key: s.key, value: s.value, description: s.description }))}
      labels={{
        title: t("siteSettingsTitle"),
        subtitle: t("siteSettingsSubtitle"),
        add: t("siteSettingsAdd"),
        colKey: t("siteSettingsColKey"),
        colValue: t("siteSettingsColValue"),
        colActions: t("siteSettingsColActions"),
      }}
    />
  );
}
