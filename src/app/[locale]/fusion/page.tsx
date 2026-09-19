import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { FusionPage } from "@/components/fusion/fusion-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Fusion" });
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle"),
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FusionPage />;
}
