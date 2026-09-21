import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale, getTranslations } from "next-intl/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

// Disable static prerendering — auth + intl providers make each request unique.
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }
  setRequestLocale(locale);

  // Get session server-side to pass to AuthProvider (avoids client polling)
  const session = await getServerSession(authOptions).catch(() => null);

  // Get all messages
  const allMessages = await getMessages();

  // Filter messages to only pass what Client Components need on initial load
  const clientMessages: Record<string, any> = {};
  const neededNamespaces = [
    "Nav",
    "LanguageSwitcher",
    "Fusion",
    "Auth",
    "Contact",
    "Common",
    "Errors",
    "Pricing",
    "Dashboard",
  ];
  for (const ns of neededNamespaces) {
    if (allMessages[ns]) {
      clientMessages[ns] = allMessages[ns];
    }
  }

  // Get footer strings server-side (footer is now a Server Component)
  const tFooter = await getTranslations({ locale, namespace: "Footer" });
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  const footerStrings = {
    tagline: tFooter("tagline"),
    product: tFooter("product"),
    legal: tFooter("legal"),
    languages: tFooter("languages"),
    rights: tFooter("rights"),
    home: tNav("home"),
    fusion: tNav("fusion"),
    pricing: tNav("pricing"),
    faq: tNav("faq"),
    contact: tNav("contact"),
    legalNotice: tFooter("legalNotice"),
    privacy: tFooter("privacy"),
  };

  return (
    <NextIntlClientProvider locale={locale} messages={clientMessages}>
      <AuthProvider session={session}>
        <div className="flex min-h-screen flex-col">
          <SiteHeader locale={locale as Locale} session={session} />
          <main className="flex-1">{children}</main>
          <SiteFooter locale={locale as Locale} strings={footerStrings} />
        </div>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
