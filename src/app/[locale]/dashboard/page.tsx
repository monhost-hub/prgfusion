import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Dashboard" });
  const tNav = await getTranslations({ locale, namespace: "Nav" });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const userId = session.user.id;
  const generations = await db.generation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { model: true },
  });

  const total = generations.length;
  const success = generations.filter((g) => g.status === "succeeded").length;
  const failed = generations.filter((g) => g.status === "failed").length;
  const last30 = generations.filter(
    (g) => Date.now() - g.createdAt.getTime() < 30 * 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        {t("welcome", { name: session.user.name || session.user.email })}
      </h1>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("statsTotal")} value={total} />
        <Stat label={t("statsSuccess")} value={success} />
        <Stat label={t("statsFailed")} value={failed} />
        <Stat label={t("statsLast30")} value={last30} />
      </div>

      {/* Generations */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-4">{t("yourGenerations")}</h2>
        {generations.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t.rich("noGenerations", {
                  link: (chunks) => (
                    <Link href={`/${locale}/fusion`} className="text-primary hover:underline inline-flex items-center">
                      <Sparkles className="mr-1 h-3 w-3" />
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card overflow-hidden">
            <div className="overflow-x-auto scroll-styled">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">{t("colDate")}</th>
                    <th className="text-left px-4 py-3">{t("colModel")}</th>
                    <th className="text-left px-4 py-3">{t("colStatus")}</th>
                    <th className="text-left px-4 py-3">{t("colDuration")}</th>
                    <th className="text-left px-4 py-3">{t("colCost")}</th>
                    <th className="text-left px-4 py-3">{t("colResult")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {generations.map((g) => (
                    <tr key={g.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {g.createdAt.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{g.model?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={g.status} label={t(`status${g.status.charAt(0).toUpperCase()}${g.status.slice(1)}` as any)} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.durationMs ? `${(g.durationMs / 1000).toFixed(1)}s` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {g.estimatedCost ? `$${g.estimatedCost.toFixed(4)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {g.outputPath ? (
                          <a href={g.outputPath} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {t("colResult")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <div className="mt-8">
        <Button asChild className="bg-brand-gradient text-white hover:opacity-90">
          <Link href={`/${locale}/fusion`}>
            <Sparkles className="mr-2 h-4 w-4" />
            {tNav("tryNow")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-blue-500/15 text-blue-500",
    succeeded: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || ""}`}>
      {label}
    </span>
  );
}
