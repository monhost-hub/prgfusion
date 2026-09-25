"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * ForgotPasswordForm
 *
 * Anti-enumeration design:
 *   - The /api/auth/forgot-password endpoint ALWAYS returns 200, whether or not
 *     the email exists in the database. We mirror that on the client by always
 *     showing the same success message after submission.
 *   - The only client-side error path is rate-limiting (429), which is shown
 *     as a toast.
 *
 * Sends the current `locale` so the server can build a localized reset link.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").toLowerCase().trim();

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });

      // 429 is the only status we treat as an error (anti-enumeration: 200 otherwise)
      if (res.status === 429) {
        toast.error(t("errorRateLimit"));
        setLoading(false);
        return;
      }

      // Always show the same success message — never reveals whether the email exists
      setSent(true);
    } catch {
      // Network failure — still show the success message to avoid leaking state
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="glass-card max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <h1 className="text-2xl font-bold">{t("forgotPasswordTitle")}</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("forgotPasswordSent")}</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = tPath("/login");
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("goToLogin")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <h1 className="text-2xl font-bold">{t("forgotPasswordTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("forgotPasswordSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gradient text-white hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {t("forgotPasswordTitle")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <a href={tPath("/login")} className="text-primary hover:underline">
              {t("goToLogin")}
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
