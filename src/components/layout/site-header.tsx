"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Menu, X, Sparkles, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { locales, localeNames, localeFlags, type Locale, useTranslatedPathname } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "next-auth/react";
import { LogOut, LayoutDashboard, Shield } from "lucide-react";

/**
 * Global header for AllCombiner.
 *
 * - Logo
 * - Primary nav (Home, Fusion, Pricing, FAQ, Contact)
 * - Language switcher (EN / FR / ES)
 * - Login / Dashboard / Logout (auth-aware)
 * - Primary CTA → Fusion
 */
export function SiteHeader() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const locale = useLocale() as Locale;
  const tPath = useTranslatedPathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

  const navItems = [
    { key: "home", href: "/" },
    { key: "fusion", href: "/fusion" },
    { key: "pricing", href: "/pricing" },
    { key: "faq", href: "/faq" },
    { key: "contact", href: "/contact" },
  ] as const;

  function isActive(href: string): boolean {
    const translated = tPath(href);
    if (href === "/") {
      return pathname === `/${locale}` || pathname === `/${locale}/`;
    }
    return pathname.startsWith(`/${locale}${href}`);
  }

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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={tPath(item.href)}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher current={locale} />

          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="hidden md:inline-flex">
                  <span className="max-w-[120px] truncate">{session.user.name || session.user.email}</span>
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={tPath("/dashboard")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> {t("dashboard")}
                  </Link>
                </DropdownMenuItem>
                {session.user.role === "ADMIN" && (
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/admin`}>
                      <Shield className="mr-2 h-4 w-4" /> {t("admin")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: `/${locale}` })}>
                  <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link href={tPath("/login")}>{t("login")}</Link>
            </Button>
          )}

          <Button asChild size="sm" className="hidden md:inline-flex bg-brand-gradient text-white hover:opacity-90">
            <Link href={tPath("/fusion")}>
              <Sparkles className="mr-1.5 h-4 w-4" /> {t("tryNow")}
            </Link>
          </Button>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={tPath(item.href)}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  isActive(item.href)
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="my-2 h-px bg-border/40" />
            {session?.user ? (
              <>
                <Link
                  href={tPath("/dashboard")}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                >
                  {t("dashboard")}
                </Link>
                {session.user.role === "ADMIN" && (
                  <Link
                    href={`/${locale}/admin`}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  >
                    {t("admin")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    signOut({ callbackUrl: `/${locale}` });
                  }}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 text-left"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <Link
                href={tPath("/login")}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
              >
                {t("login")}
              </Link>
            )}
            <Button asChild size="sm" className="mt-2 bg-brand-gradient text-white hover:opacity-90">
              <Link href={tPath("/fusion")} onClick={() => setMobileOpen(false)}>
                <Sparkles className="mr-1.5 h-4 w-4" /> {t("tryNow")}
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

function LanguageSwitcher({ current }: { current: Locale }) {
  const t = useTranslations("LanguageSwitcher");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">{localeNames[current]}</span>
          <span className="sm:hidden text-base leading-none">{localeFlags[current]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem key={l} asChild>
            <Link
              href={`/${l}`}
              className={cn("flex items-center gap-2", l === current && "font-semibold")}
            >
              <span className="text-base leading-none">{localeFlags[l]}</span>
              {localeNames[l]}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
