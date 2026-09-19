"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Sparkles } from "lucide-react";
import { locales, localeNames, localeFlags, type Locale, useTranslatedPathname } from "@/i18n/routing";

/**
 * Global footer for AllCombiner.
 *
 * - Product nav (Home, Fusion, Pricing, FAQ, Contact)
 * - Legal nav (Legal, Privacy)
 * - Languages (EN / FR / ES)
 * - Tagline + copyright
 */
export function SiteFooter() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const tPath = useTranslatedPathname();
  const year = new Date().getFullYear();

  const productNav = [
    { key: "Nav.home", href: "/" },
    { key: "Nav.fusion", href: "/fusion" },
    { key: "Nav.pricing", href: "/pricing" },
    { key: "Nav.faq", href: "/faq" },
    { key: "Nav.contact", href: "/contact" },
  ] as const;

  const legalNav = [
    { key: "Footer.legalNotice", href: "/legal" },
    { key: "Footer.privacy", href: "/privacy" },
  ] as const;

  return (
    <footer className="mt-auto border-t border-border/40 bg-muted/30">
      <div className="container mx-auto px-4 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2 space-y-3">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 font-bold text-lg tracking-tight"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <span>
                All<span className="text-brand-gradient">Combiner</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              {t("Footer.tagline")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("Footer.product")}
            </h4>
            <ul className="space-y-2">
              {productNav.map((item) => (
                <li key={item.key}>
                  <Link
                    href={tPath(item.href)}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {t("Footer.legal")}
            </h4>
            <ul className="space-y-2">
              {legalNav.map((item) => (
                <li key={item.key}>
                  <Link
                    href={tPath(item.href)}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6">
              {t("Footer.languages")}
            </h4>
            <ul className="space-y-2">
              {locales.map((l) => (
                <li key={l}>
                  <Link
                    href={`/${l}`}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    <span className="mr-1.5">{localeFlags[l]}</span>
                    {localeNames[l]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <p>© {year} AllCombiner. {t("Footer.rights")}</p>
          <p className="opacity-70">www.allcombiner.com</p>
        </div>
      </div>
    </footer>
  );
}
