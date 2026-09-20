import { setRequestLocale, getTranslations } from "next-intl/server";
import { HomePage } from "@/components/home/home-page";
import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("title"),
    description: t("description"),
    keywords: t("keywords"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url: process.env.NEXT_PUBLIC_APP_URL,
      siteName: "AllCombiner",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Get all Home strings server-side
  const t = await getTranslations({ locale, namespace: "Home" });
  const strings = {
    heroBadge: t("heroBadge"),
    heroTitle: t("heroTitle"),
    heroSubtitle: t("heroSubtitle"),
    heroCtaPrimary: t("heroCtaPrimary"),
    heroCtaSecondary: t("heroCtaSecondary"),
    heroNoCreditCard: t("heroNoCreditCard"),
    trustTitle: t("trustTitle"),
    trustSubtitle: t("trustSubtitle"),
    trust1Title: t("trust1Title"),
    trust1Desc: t("trust1Desc"),
    trust2Title: t("trust2Title"),
    trust2Desc: t("trust2Desc"),
    trust3Title: t("trust3Title"),
    trust3Desc: t("trust3Desc"),
    trust4Title: t("trust4Title"),
    trust4Desc: t("trust4Desc"),
    howTitle: t("howTitle"),
    howSubtitle: t("howSubtitle"),
    step1Title: t("step1Title"),
    step1Desc: t("step1Desc"),
    step2Title: t("step2Title"),
    step2Desc: t("step2Desc"),
    step3Title: t("step3Title"),
    step3Desc: t("step3Desc"),
    modelsTitle: t("modelsTitle"),
    modelsSubtitle: t("modelsSubtitle"),
    modelLiteName: t("modelLiteName"),
    modelLiteDesc: t("modelLiteDesc"),
    model2Name: t("model2Name"),
    model2Desc: t("model2Desc"),
    modelProName: t("modelProName"),
    modelProDesc: t("modelProDesc"),
    ctaTitle: t("ctaTitle"),
    ctaSubtitle: t("ctaSubtitle"),
    ctaButton: t("ctaButton"),
  };

  return <HomePage locale={locale as Locale} strings={strings} />;
}
