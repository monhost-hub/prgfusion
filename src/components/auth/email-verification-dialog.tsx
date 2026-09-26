"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MailCheck, Loader2, Send, LogIn, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * EmailVerificationDialog — reusable modal for the EMAIL_NOT_VERIFIED case.
 *
 * Shows when a user tries to buy credits or subscribe but their email
 * is not verified. Works for both authenticated (unverified) users and
 * unauthenticated visitors.
 *
 * Props:
 *   open: boolean — controlled by parent
 *   onOpenChange: (open: boolean) => void — controlled by parent
 *   context: "recharge" | "subscription" — changes the message wording
 */

export function EmailVerificationDialog({
  open,
  onOpenChange,
  context = "recharge",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: "recharge" | "subscription";
}) {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const { status } = useSession();
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<"idle" | "sent" | "error">("idle");

  const isAuthed = status === "authenticated";

  async function handleResend() {
    setResending(true);
    setResendResult("idle");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setResendResult("sent");
      } else {
        setResendResult("error");
      }
    } catch {
      setResendResult("error");
    } finally {
      setResending(false);
    }
  }

  const titleKey = context === "subscription"
    ? "verifyRequiredSubscription"
    : "verifyRequiredRecharge";

  const descKey = context === "subscription"
    ? "verifyRequiredDescSubscription"
    : "verifyRequiredDescRecharge";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30">
              <MailCheck className="h-5 w-5 text-amber-500" />
            </div>
            <DialogTitle className="text-lg">
              {t(titleKey)}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {t(descKey)}
          </DialogDescription>
        </DialogHeader>

        {/* Resend result — shown inline without closing the dialog */}
        {resendResult === "sent" && (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <MailCheck className="h-3.5 w-3.5 flex-shrink-0" />
            {t("resendVerificationSent")}
          </div>
        )}
        {resendResult === "error" && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive flex items-center gap-2">
            {t("resendVerificationError")}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {isAuthed ? (
            <>
              {/* Authenticated but unverified — single action: resend verification email */}
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full bg-brand-gradient text-white hover:opacity-90"
                size="sm"
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
              <p className="text-xs text-muted-foreground text-center mt-1">
                {t("resendHintCheckInbox")}
              </p>
            </>
          ) : (
            <>
              {/* Not authenticated — signup + login */}
              <Button
                asChild
                className="w-full bg-brand-gradient text-white hover:opacity-90"
                size="sm"
              >
                <a href={tPath("/signup")}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("signup")}
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full"
              >
                <a href={tPath("/login")}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {t("login")}
                </a>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
