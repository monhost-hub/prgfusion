import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Legal" });

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pageSubtitle")}</p>

        <div className="mt-10 space-y-8">
          <Section title={t("editorTitle")}>{t("editorBody")}</Section>
          <Section title={t("hostingTitle")}>
            {t("hostingBody", { host: "Vercel Inc. (placeholder — fill in your real host)" })}
          </Section>
          <Section title={t("ipTitle")}>{t("ipBody")}</Section>
          <Section title={t("contactTitle")}>{t("contactBody")}</Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Legal" });
  return { title: t("pageTitle"), description: t("pageSubtitle") };
}
