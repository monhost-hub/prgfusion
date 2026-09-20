"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { LogOut, LayoutDashboard, Shield } from "lucide-react";
import { type Locale, useTranslatedPathname } from "@/i18n/routing";

export function UserMenu({ session }: { session: any }) {
  const t = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const tPath = useTranslatedPathname();

  if (!session?.user) {
    return (
      <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
        <Link href={tPath("/login")}>{t("login")}</Link>
      </Button>
    );
  }

  return (
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
  );
}
