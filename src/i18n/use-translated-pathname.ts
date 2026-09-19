"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { locales, type Locale } from "@/i18n/routing";

/**
 * Returns a function `tPath(path)` that translates a logical path like
 * "/pricing" into the locale-prefixed path "/en/pricing".
 *
 * Must be used inside a NextIntlClientProvider boundary.
 */
export function useTranslatedPathname() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (path: string) => {
      // Ensure leading slash
      const p = path.startsWith("/") ? path : `/${path}`;
      return `/${locale}${p === "/" ? "" : p}`;
    },
    [locale]
  );
}

export { locales };
