"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  Info,
  XCircle,
  Clock,
  Loader2,
  LayoutDashboard,
  LogIn,
  Mail,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * VerifyEmailClient
 *
 * Reads `token` from the URL query string, calls the verification API on mount,
 * and renders one of five UI states:
 *   - loading   : spinner + "Verifying..."
 *   - verified  : green check + success message + dashboard button
 *   - already   : blue info + "already verified" + dashboard button
 *   - no-token  : neutral info + "no token in URL" + resend button (authed) / login button (anon)
 *   - invalid   : red X + "invalid link" + resend button (authed) / login button (anon)
 *   - expired   : orange clock + "expired link" + resend button (authed) / login button (anon)
 *   - sent      : green check + "email sent, check your inbox" + back-to-dashboard (authed only)
 *
 * The "Resend email" button now actually calls /api/auth/resend-verification
 * (instead of redirecting to /login). The backend endpoint requires an
 * authenticated session — if the user is not logged in, we fall back to
 * showing a login CTA.
 *
 * Must be wrapped in <Suspense> when used inside a page because it relies on
 * `useSearchParams` (Next.js requires a Suspense boundary for that hook).
 */

type State = "loading" | "verified" | "already" | "invalid" | "expired" | "no-token" | "sent";

export function VerifyEmailClient() {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const router = useRouter();
  const { status } = useSession();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>(token ? "loading" : "no-token");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          { method: "GET" }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.ok && data?.ok) {
          if (data.status === "already") {
            setState("already");
          } else {
            // status === "verified"
            setState("verified");
          }
          return;
        }

        // 400 with error: "invalid" | "expired"
        if (data?.error === "expired") {
          setState("expired");
        } else {
          // "invalid" or unknown → treat as invalid link
          setState("invalid");
        }
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleResend() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setState("sent");
      }
    } catch {
      // Silently ignore — the user can retry via the button below
    } finally {
      setResending(false);
    }
  }

  // Auth-aware render helpers
  const isAuthed = status === "authenticated";

  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">{t("verifyEmailTitle")}</h1>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">{t("verifyEmailLoading")}</p>
          </>
        )}

        {state === "verified" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-medium">{t("verifyEmailSuccess")}</p>
            <Button
              type="button"
              className="w-full bg-brand-gradient text-white hover:opacity-90"
              onClick={() => {
                router.push(tPath("/dashboard"));
                router.refresh();
              }}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("goToDashboard")}
            </Button>
          </>
        )}

        {state === "already" && (
          <>
            <Info className="h-12 w-12 text-blue-500" />
            <p className="font-medium">{t("verifyEmailAlready")}</p>
            <Button
              type="button"
              className="w-full bg-brand-gradient text-white hover:opacity-90"
              onClick={() => {
                router.push(tPath("/dashboard"));
                router.refresh();
              }}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t("goToDashboard")}
            </Button>
          </>
        )}

        {state === "sent" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <p className="font-medium">{t("resendVerificationSent")}</p>
            {isAuthed ? (
              <Button
                type="button"
                className="w-full bg-brand-gradient text-white hover:opacity-90"
                onClick={() => {
                  router.push(tPath("/dashboard"));
                  router.refresh();
                }}
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                {t("goToDashboard")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  router.push(tPath("/login"));
                  router.refresh();
                }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("goToLogin")}
              </Button>
            )}
          </>
        )}

        {state === "no-token" && (
          <>
            <Info className="h-12 w-12 text-blue-500" />
            <p className="font-medium">{t("verifyEmailNoToken")}</p>
            {isAuthed ? (
              <Button
                type="button"
                className="w-full bg-brand-gradient text-white hover:opacity-90"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("resendVerification")}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t("resendVerification")}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  router.push(tPath("/login"));
                  router.refresh();
                }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("goToLogin")}
              </Button>
            )}
          </>
        )}

        {state === "invalid" && (
          <>
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="font-medium">{t("verifyEmailInvalid")}</p>
            {isAuthed ? (
              <Button
                type="button"
                className="w-full bg-brand-gradient text-white hover:opacity-90"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("resendVerification")}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t("resendVerification")}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  router.push(tPath("/login"));
                  router.refresh();
                }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("goToLogin")}
              </Button>
            )}
          </>
        )}

        {state === "expired" && (
          <>
            <Clock className="h-12 w-12 text-orange-500" />
            <p className="font-medium">{t("verifyEmailExpired")}</p>
            {isAuthed ? (
              <Button
                type="button"
                className="w-full bg-brand-gradient text-white hover:opacity-90"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("resendVerification")}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t("resendVerification")}
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  router.push(tPath("/login"));
                  router.refresh();
                }}
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("goToLogin")}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
