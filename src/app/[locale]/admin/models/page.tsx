import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminModelsClient } from "@/components/admin/admin-models-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const models = await db.aIModel.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <AdminModelsClient
      models={models.map((m) => ({
        id: m.id,
        name: m.name,
        providerId: m.providerId,
        provider: m.provider,
        description: m.description,
        costPerCall: m.costPerCall,
        enabled: m.enabled,
        isActive: m.isActive,
      }))}
      labels={{
        title: t("aiModelsTitle"),
        subtitle: t("aiModelsSubtitle"),
        add: t("aiModelsAdd"),
        edit: t("aiModelsEdit"),
        test: t("aiModelsTest"),
        setActive: t("aiModelsSetActive"),
        active: t("aiModelsActive"),
        enable: t("aiModelsEnable"),
        disable: t("aiModelsDisable"),
        colName: t("aiModelsColName"),
        colProviderId: t("aiModelsColProviderId"),
        colProvider: t("aiModelsColProvider"),
        colCost: t("aiModelsColCost"),
        colEnabled: t("aiModelsColEnabled"),
        colActive: t("aiModelsColActive"),
        colActions: t("aiModelsColActions"),
        fieldName: t("aiModelsFieldName"),
        fieldProviderId: t("aiModelsFieldProviderId"),
        fieldProvider: t("aiModelsFieldProvider"),
        fieldDescription: t("aiModelsFieldDescription"),
        fieldCost: t("aiModelsFieldCost"),
        fieldEnabled: t("aiModelsFieldEnabled"),
        fieldActive: t("aiModelsFieldActive"),
        testOk: t("aiModelsTestOk"),
        testFail: t("aiModelsTestFail"),
        editTitle: t("aiModelsEditTitle"),
        addTitle: t("aiModelsAddTitle"),
        save: "Save",
        cancel: "Cancel",
      }}
    />
  );
}
