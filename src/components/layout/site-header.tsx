import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { SiteHeaderNav } from "./site-header-nav";
import { LanguageSwitcherLazy } from "./language-switcher-lazy";
import { UserMenuLazy } from "./user-menu-lazy";
import { CreditsBadgeLazy } from "./credits-badge-lazy";

/**
 * Global header for AllCombiner — Server Component wrapper.
 *
 * Renders the logo, desktop nav (static HTML), CTA button server-side.
 * Delegates interactive parts (mobile menu, language switcher, user menu,
 * credits badge) to lazy-loaded client components.
 */
export async function SiteHeader({
  locale,
  session,
}: {
  locale: Locale;
  session: any;
}) {
  const t = await getTranslations({ locale, namespace: "Nav" });

  const navItems = [
    { key: "home", href: `/${locale}` },
    { key: "fusion", href: `/${locale}/fusion` },
    { key: "pricing", href: `/${locale}/pricing` },
    { key: "faq", href: `/${locale}/faq` },
    { key: "contact", href: `/${locale}/contact` },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 font-bold text-lg tracking-tight"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          <span>
            All<span className="text-brand-gradient">Combiner</span>
          </span>
        </Link>

        {/* Desktop nav — server-rendered, no JS */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* Right cluster — mix of server HTML + lazy client components */}
        <div className="flex items-center gap-2">
          {/* Language switcher — lazy-loaded Radix DropdownMenu */}
          <LanguageSwitcherLazy current={locale} />

          {/* Credits badge — lazy-loaded, only rendered if logged in */}
          {session?.user && <CreditsBadgeLazy />}

          {/* User menu — lazy-loaded Radix DropdownMenu */}
          <UserMenuLazy session={session} />

          {/* CTA button — server-rendered */}
          <Button asChild size="sm" className="hidden md:inline-flex bg-brand-gradient text-white hover:opacity-90">
            <Link href={`/${locale}/fusion`}>
              <Sparkles className="mr-1.5 h-4 w-4" /> {t("tryNow")}
            </Link>
          </Button>

          {/* Mobile menu — client component (useState) */}
          <SiteHeaderNav locale={locale} session={session} />
        </div>
      </div>
    </header>
  );
}
