import { setRequestLocale, getTranslations } from "next-intl/server";
import { getFusionPrompt } from "@/lib/ai/fusion";
import { AdminFusionSettingsClient } from "@/components/admin/admin-fusion-settings-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });
  const prompt = await getFusionPrompt();

  return (
    <AdminFusionSettingsClient
      initialPrompt={prompt}
      labels={{
        title: t("fusionSettingsTitle"),
        subtitle: t("fusionSettingsSubtitle"),
        prompt: t("fusionSettingsPrompt"),
        promptHint: t("fusionSettingsPromptHint"),
        save: t("fusionSettingsSave"),
        saved: t("fusionSettingsSaved"),
      }}
    />
  );
}
