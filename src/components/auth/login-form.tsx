"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * Validates a callback URL to prevent open-redirect attacks.
 *
 * Rules:
 *  - Must be a relative URL (start with "/")
 *  - Must NOT start with "//" (protocol-relative URL — would be https://evil.com)
 *  - Must NOT contain a colon before the first "/" (avoids "/\evil.com" tricks)
 *  - Empty/invalid → falls back to /dashboard
 *
 * Examples:
 *  - "/fr/pricing"           → OK
 *  - "/fr/dashboard"         → OK
 *  - "//evil.com"            → REJECTED (fallback to /dashboard)
 *  - "https://evil.com"      → REJECTED (doesn't start with "/")
 *  - ""                      → fallback to /dashboard
 */
function safeCallbackUrl(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  // Decode once in case it was URL-encoded (e.g. %2F → /)
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}

export function LoginForm() {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  // Read & validate callbackUrl from ?callbackUrl=...
  // Default: /dashboard. If the user came from Pricing, this will be /{locale}/pricing.
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), tPath("/dashboard"));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").toLowerCase().trim();
    const password = String(form.get("password") || "");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      // NextAuth will use this as the post-login redirect target.
      // We've already validated it's a relative path (no open-redirect risk).
      callbackUrl,
    });

    if (res?.error) {
      setLoading(false);
      toast.error(t("invalidCredentials"));
      return;
    }
    toast.success(t("welcomeBack", { name: email }));
    // NextAuth returns res.url when callbackUrl is set — use it as the destination.
    // Fallback to our validated callbackUrl if NextAuth didn't return a URL.
    const destination = res?.url || callbackUrl;
    router.push(destination);
    router.refresh();
  }

  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand-gradient text-white hover:opacity-90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            {t("login")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <a href={tPath("/signup")} className="text-primary hover:underline">
              {t("createOne")}
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
