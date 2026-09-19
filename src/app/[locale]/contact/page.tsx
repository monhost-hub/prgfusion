import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { ContactForm } from "@/components/auth/contact-form";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Contact" });

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pageSubtitle")}</p>
      </div>
      <div className="max-w-xl mx-auto">
        <ContactForm />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return { title: t("pageTitle"), description: t("pageSubtitle") };
}
