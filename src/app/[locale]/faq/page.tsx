import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Faq" });

  const items = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    q: t(`q${i}` as const),
    a: t(`a${i}` as const),
  }));

  // pageSubtitle contains a {contactLink} placeholder — we split it manually
  // to render the link as a real <Link>.
  const subtitleParts = t("pageSubtitle").split("{contactLink}");

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-3 text-muted-foreground">
          {subtitleParts[0]}
          <Link href={`/${locale}/contact`} className="text-primary hover:underline">
            {t("contactLink")}
          </Link>
          {subtitleParts[1]}
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
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
  const t = await getTranslations({ locale, namespace: "Faq" });
  return { title: t("pageTitle"), description: t("pageTitle") };
}
