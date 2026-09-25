"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * ResetPasswordForm
 *
 * Reads `token` from the URL query string (rendered as a hidden field) and
 * submits the new password to /api/auth/reset-password.
 *
 * Validation:
 *   - password >= 8 chars
 *   - confirm must match password
 *
 * Server error mapping:
 *   - 410 → "expired link" message (t("passwordResetExpired"))
 *   - 400 → "invalid link" message (t("passwordResetInvalid"))
 *   - 429 → toast error (rate limit)
 *
 * On success → toast.success + redirect to /{locale}/login.
 *
 * Must be wrapped in <Suspense> when used inside a page (uses useSearchParams).
 */
export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password.length < 8) {
      setError(t("passwordResetInvalid"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    if (!token) {
      setError(t("passwordResetInvalid"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        toast.success(t("passwordResetSuccess"));
        const dest = tPath("/login");
        router.push(dest);
        router.refresh();
        return;
      }

      // 410 → expired, 400 → invalid, 429 → rate limit
      if (res.status === 429) {
        toast.error(t("errorRateLimit"));
        setLoading(false);
        return;
      }
      if (res.status === 410) {
        setError(t("passwordResetExpired"));
        setLoading(false);
        return;
      }
      // 400 or any other error
      setError(t("passwordResetInvalid"));
      setLoading(false);
    } catch {
      setError(t("errorGeneric"));
      setLoading(false);
    }
  }

  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <h1 className="text-2xl font-bold">{t("resetPasswordTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("resetPasswordSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Hidden token field — read from URL, never typed by the user */}
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("newPassword")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t("confirmPassword")}</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gradient text-white hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="mr-2 h-4 w-4" />
            )}
            {t("passwordReset")}
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
