import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminGenerationsClient } from "@/components/admin/admin-generations-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const generations = await db.generation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true, model: true },
  });

  return (
    <AdminGenerationsClient
      generations={generations.map((g) => ({
        id: g.id,
        status: g.status,
        durationMs: g.durationMs,
        estimatedCost: g.estimatedCost,
        error: g.error,
        createdAt: g.createdAt.toISOString(),
        userEmail: g.user.email,
        modelName: g.model?.name ?? "—",
      }))}
      labels={{
        title: t("generationsTitle"),
        colDate: t("generationsColDate"),
        colUser: t("generationsColUser"),
        colModel: t("generationsColModel"),
        colStatus: t("generationsColStatus"),
        colDuration: t("generationsColDuration"),
        colCost: t("generationsColCost"),
        colError: t("generationsColError"),
      }}
    />
  );
}
