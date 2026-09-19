"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function ContactForm() {
  const t = useTranslations("Contact");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          res.status === 429 ? t("errorRateLimit") : data?.error || t("errorGeneric")
        );
        return;
      }
      toast.success(t("success"));
      (e.target as HTMLFormElement).reset();
    } catch {
      toast.error(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("name")}</Label>
            <Input id="name" name="name" required placeholder={t("namePlaceholder")} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required placeholder={t("emailPlaceholder")} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">{t("subject")}</Label>
            <Input id="subject" name="subject" placeholder={t("subjectPlaceholder")} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">{t("message")}</Label>
            <Textarea
              id="message"
              name="message"
              required
              placeholder={t("messagePlaceholder")}
              rows={5}
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand-gradient text-white hover:opacity-90">
            <Send className="mr-2 h-4 w-4" />
            {loading ? "..." : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
