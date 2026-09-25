"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Info,
  XCircle,
  Clock,
  Loader2,
  LayoutDashboard,
  LogIn,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * VerifyEmailClient
 *
 * Reads `token` from the URL query string, calls the verification API on mount,
 * and renders one of four UI states:
 *   - loading   : spinner + "Verifying..."
 *   - verified  : green check + success message + dashboard button
 *   - already   : blue info + "already verified" + dashboard button
 *   - invalid   : red X + "invalid or expired link" + resend button
 *   - expired   : orange clock + "expired link" + resend button
 *
 * Must be wrapped in <Suspense> when used inside a page because it relies on
 * `useSearchParams` (Next.js requires a Suspense boundary for that hook).
 */

type State = "loading" | "verified" | "already" | "invalid" | "expired";

export function VerifyEmailClient() {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>(token ? "loading" : "invalid");

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

        {state === "invalid" && (
          <>
            <XCircle className="h-12 w-12 text-red-500" />
            <p className="font-medium">{t("verifyEmailInvalid")}</p>
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
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                router.push(tPath("/login"));
                router.refresh();
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              {t("resendVerification")}
            </Button>
          </>
        )}

        {state === "expired" && (
          <>
            <Clock className="h-12 w-12 text-orange-500" />
            <p className="font-medium">{t("verifyEmailExpired")}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                router.push(tPath("/login"));
                router.refresh();
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              {t("resendVerification")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
