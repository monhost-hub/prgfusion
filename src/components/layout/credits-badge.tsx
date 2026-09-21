"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { useTranslatedPathname } from "@/i18n/routing";

export function CreditsBadge() {
  const tPath = useTranslatedPathname();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchCredits = () => {
      fetch("/api/user/credits")
        .then((r) => r.json())
        .then((data) => {
          if (mounted && typeof data.credits === "number") {
            setCredits(data.credits);
          }
        })
        .catch(() => {});
    };
    fetchCredits();
    const interval = setInterval(fetchCredits, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (credits === null) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground animate-pulse">
        <Coins className="h-3 w-3" />
        …
      </span>
    );
  }

  const isLow = credits < 3;

  return (
    <Link
      href={tPath("/pricing")}
      className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        isLow
          ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25"
      }`}
      title={isLow ? "Solde faible — clique pour recharger" : "Ton solde de crédits"}
    >
      <Coins className="h-3 w-3" />
      {credits}
    </Link>
  );
}
