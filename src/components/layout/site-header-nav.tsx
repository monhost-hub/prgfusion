"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Locale, useTranslatedPathname } from "@/i18n/routing";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

/**
 * Client-side nav for the header — handles mobile menu toggle + active link.
 * Only loaded on client. Does NOT import Radix DropdownMenu.
 */
export function SiteHeaderNav({
  locale,
  session,
}: {
  locale: Locale;
  session: Session | null;
}) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const tPath = useTranslatedPathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <>
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
    </>
  );
}

import { Sparkles } from "lucide-react";
