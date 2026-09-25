import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      {/* Suspense boundary required because VerifyEmailClient uses useSearchParams
          (to read the ?token=... parameter from the verification email link). */}
      <Suspense fallback={null}>
        <VerifyEmailClient />
      </Suspense>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("verifyEmailTitle") };
}
