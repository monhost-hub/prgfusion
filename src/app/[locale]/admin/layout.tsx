import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { setRequestLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Cpu,
  Plug,
  Settings2,
  DollarSign,
  CreditCard,
  Sliders,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin layout — protects all /admin/* routes server-side.
 * If the user is not an admin, redirect them to the locale home.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (session.user.role !== "ADMIN") {
    redirect(`/${locale}`);
  }

  const nav = [
    { href: "", icon: LayoutDashboard, key: "navDashboard" },
    { href: "/users", icon: Users, key: "navUsers" },
    { href: "/generations", icon: Sparkles, key: "navGenerations" },
    { href: "/models", icon: Cpu, key: "navAiModels" },
    { href: "/openrouter", icon: Plug, key: "navOpenrouter" },
    { href: "/fusion-settings", icon: Sliders, key: "navFusionSettings" },
    { href: "/pricing", icon: DollarSign, key: "navPricing" },
    { href: "/payments", icon: CreditCard, key: "Paiements" },
    { href: "/site-settings", icon: Settings2, key: "navSiteSettings" },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-20 self-start">
          <div className="rounded-xl border border-border/40 bg-card p-3">
            <div className="px-2 pb-2 mb-2 border-b border-border/40 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-gradient text-white">
                <Settings2 className="h-4 w-4" />
              </span>
              <span className="font-semibold text-sm">{t("title")}</span>
            </div>
            <nav className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <Link
                  key={item.key}
                  href={`/${locale}/admin${item.href}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.key as any)}
                </Link>
              ))}
            </nav>
            <div className="mt-2 pt-2 border-t border-border/40">
              <Link
                href={`/${locale}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("navBackToSite")}
              </Link>
            </div>
          </div>
        </aside>

        <div>{children}</div>
      </div>
    </div>
  );
}
