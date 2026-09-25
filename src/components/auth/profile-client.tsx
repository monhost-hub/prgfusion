"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MailCheck, MailX, Loader2, KeyRound, User, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * ProfileClient — user profile page (client component).
 *
 * Shows:
 *   - Name
 *   - Email + verification status
 *   - Change password form (current + new + confirm)
 *
 * After password change, sessionVersion is incremented server-side.
 * The user's current JWT becomes invalid → they must re-login.
 * We call signOut() client-side to clear the stale session immediately.
 */
export function ProfileClient({ userEmail, userName, emailVerified }: { userEmail: string; userName: string; emailVerified: Date | null }) {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();

  // Password change form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  // Email verification status passed from server component
  const isVerified = !!emailVerified;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    if (currentPassword === newPassword) {
      toast.error(t("passwordSameError"));
      return;
    }

    setChanging(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = res.status === 403
          ? t("currentPasswordError")
          : data?.error || t("errorGeneric");
        toast.error(msg);
        return;
      }

      // Success — password changed, sessionVersion incremented
      // Old JWT is now invalid → sign out and redirect to login
      toast.success(t("passwordChangedSuccess"));
      setTimeout(() => {
        signOut({ callbackUrl: tPath("/login") });
      }, 1500);
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* === Account info === */}
      <Card className="glass-card">
        <CardHeader>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("profileTitle")}
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{t("name")}</Label>
              <p className="text-sm font-medium">{userName || t("nameNotSet")}</p>
            </div>
          </div>

          {/* Email + verification status */}
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">{t("email")}</Label>
              <p className="text-sm font-medium">{userEmail}</p>
            </div>
            {isVerified ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                <MailCheck className="h-3 w-3" />
                {t("emailVerified")}
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                <MailX className="h-3 w-3" />
                {t("emailNotVerified")}
              </Badge>
            )}
          </div>

          {/* Resend verification (if not verified) */}
          {!isVerified && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full"
            >
              <a href={tPath("/verify-email")}>
                <MailCheck className="mr-2 h-4 w-4" />
                {t("resendVerification")}
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* === Change password === */}
      <Card className="glass-card">
        <CardHeader>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {t("changePasswordTitle")}
          </h3>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button
              onClick={() => setShowPasswordForm(true)}
              variant="outline"
              className="w-full"
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t("changePassword")}
            </Button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t("newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={changing}
                  className="flex-1 bg-brand-gradient text-white hover:opacity-90"
                >
                  {changing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("changing")}
                    </>
                  ) : (
                    t("changePassword")
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
