"use client";
import dynamic from "next/dynamic";
const UserMenu = dynamic(
  () => import("./user-menu").then((m) => m.UserMenu),
  { ssr: false, loading: () => null }
);
export { UserMenu };
