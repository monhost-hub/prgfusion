"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslatedPathname } from "@/i18n/routing";

export function SignupForm() {
  const t = useTranslations("Auth");
  const tPath = useTranslatedPathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").toLowerCase().trim();
    const name = String(form.get("name") || "").trim();
    const password = String(form.get("password") || "");

    if (password.length < 8) {
      setLoading(false);
      toast.error("Password must be at least 8 characters.");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        toast.error(data?.error || t("errorGeneric"));
        return;
      }
      // Check whether the verification email was actually sent.
      // If not, warn the user — they'll need to click "Resend email" from the
      // dashboard verification banner (separate feature).
      if (data.emailSent === false) {
        toast.warning(t("emailNotSent"));
      }
      // Auto-login
      const r = await signIn("credentials", { email, password, redirect: false });
      if (r?.error) {
        setLoading(false);
        toast.error(t("invalidCredentials"));
        return;
      }
      // Notify the user to check their inbox to activate the account.
      toast.info(t("checkYourEmail"));
      toast.success(t("welcomeBack", { name: name || email }));
      router.push(tPath("/dashboard"));
      router.refresh();
    } catch {
      setLoading(false);
      toast.error(t("errorGeneric"));
    }
  }

  return (
    <Card className="glass-card max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <h1 className="text-2xl font-bold">{t("signupTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("signupSubtitle")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" type="text" autoComplete="name" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand-gradient text-white hover:opacity-90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {t("signup")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <a href={tPath("/login")} className="text-primary hover:underline">
              {t("loginHere")}
            </a>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
