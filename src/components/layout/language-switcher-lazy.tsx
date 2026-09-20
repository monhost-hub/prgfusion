"use client";
import dynamic from "next/dynamic";
const LanguageSwitcher = dynamic(
  () => import("./language-switcher").then((m) => m.LanguageSwitcher),
  { ssr: false, loading: () => null }
);
export { LanguageSwitcher };
