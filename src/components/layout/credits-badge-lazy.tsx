"use client";
import dynamic from "next/dynamic";
const CreditsBadge = dynamic(
  () => import("./credits-badge").then((m) => m.CreditsBadge),
  { ssr: false, loading: () => null }
);
export { CreditsBadge };
