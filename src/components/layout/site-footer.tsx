import Link from "next/link";
import { Sparkles } from "lucide-react";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/routing";

/**
 * Global footer for AllCombiner — Server Component.
 *
 * Receives all translated strings + locale as props from the server layout.
 * No "use client", no useTranslations, no useLocale — pure HTML.
 */
export function SiteFooter({
  locale,
  strings,
}: {
  locale: Locale;
  strings: {
    tagline: string;
    product: string;
    legal: string;
    languages: string;
    rights: string;
    home: string;
    fusion: string;
    pricing: string;
    faq: string;
    contact: string;
    legalNotice: string;
    privacy: string;
  };
}) {
  const year = new Date().getFullYear();

  const productNav = [
    { label: strings.home, href: `/${locale}` },
    { label: strings.fusion, href: `/${locale}/fusion` },
    { label: strings.pricing, href: `/${locale}/pricing` },
    { label: strings.faq, href: `/${locale}/faq` },
    { label: strings.contact, href: `/${locale}/contact` },
  ];

  const legalNav = [
    { label: strings.legalNotice, href: `/${locale}/legal` },
    { label: strings.privacy, href: `/${locale}/privacy` },
  ];

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
              {strings.tagline}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {strings.product}
            </h4>
            <ul className="space-y-2">
              {productNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + Languages */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {strings.legal}
            </h4>
            <ul className="space-y-2">
              {legalNav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-6">
              {strings.languages}
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
          <p>© {year} AllCombiner. {strings.rights}</p>
          <p className="opacity-70">www.allcombiner.com</p>
        </div>
      </div>
    </footer>
  );
}
