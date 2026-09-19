import { setRequestLocale, getTranslations } from "next-intl/server";
import { AdminOpenRouterClient } from "@/components/admin/admin-openrouter-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const hasKey = Boolean(process.env.OPENROUTER_API_KEY);

  return (
    <AdminOpenRouterClient
      hasKey={hasKey}
      labels={{
        title: t("openrouterTitle"),
        subtitle: t("openrouterSubtitle"),
        apiKey: t("openrouterApiKey"),
        apiKeyHint: t("openrouterApiKeyHint"),
        status: t("openrouterStatus"),
        statusOk: t("openrouterStatusOk"),
        statusMissing: t("openrouterStatusMissing"),
        test: t("openrouterTest"),
        activeModel: t("openrouterActiveModel"),
        testOk: t("openrouterTestOk"),
        testFail: t("openrouterTestFail"),
      }}
    />
  );
}
