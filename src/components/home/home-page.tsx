"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Sparkles, Users, Scan, Handshake, Camera, ArrowRight, Upload, Cpu, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslatedPathname } from "@/i18n/routing";

export function HomePage() {
  const t = useTranslations("Home");
  const tPath = useTranslatedPathname();

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative overflow-hidden hero-glow bg-dot-grid">
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-32 md:pb-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              {t("heroBadge")}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              {t("heroTitle")}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t("heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-brand-gradient text-white hover:opacity-90 shadow-glow"
              >
                <Link href={tPath("/fusion")}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("heroCtaPrimary")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={tPath("/pricing")}>{t("heroCtaSecondary")}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t("heroNoCreditCard")}</p>
          </div>

          {/* Visual: two photos → one */}
          <div className="mt-16 md:mt-24 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
              <DemoPhoto label="Photo A" color="from-emerald-500 to-teal-500" />
              <div className="hidden md:flex flex-col items-center gap-2">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-gradient text-white shadow-glow">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">AllCombiner</span>
              </div>
              <DemoPhoto label="Photo B" color="from-amber-500 to-rose-500" />
            </div>
            <div className="mt-6 mx-auto max-w-md">
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-emerald-500/30 via-teal-500/30 to-amber-500/30 backdrop-blur" />
                <p className="mt-2 text-center text-xs text-muted-foreground">Fused photo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("trustTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("trustSubtitle")}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={<Scan className="h-5 w-5" />} title={t("trust1Title")} desc={t("trust1Desc")} />
          <FeatureCard icon={<Users className="h-5 w-5" />} title={t("trust2Title")} desc={t("trust2Desc")} />
          <FeatureCard icon={<Handshake className="h-5 w-5" />} title={t("trust3Title")} desc={t("trust3Desc")} />
          <FeatureCard icon={<Camera className="h-5 w-5" />} title={t("trust4Title")} desc={t("trust4Desc")} />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-muted/30 border-y border-border/40">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("howTitle")}</h2>
            <p className="mt-3 text-muted-foreground">{t("howSubtitle")}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            <StepCard num={1} icon={<Upload className="h-5 w-5" />} title={t("step1Title")} desc={t("step1Desc")} />
            <StepCard num={2} icon={<Cpu className="h-5 w-5" />} title={t("step2Title")} desc={t("step2Desc")} />
            <StepCard num={3} icon={<Download className="h-5 w-5" />} title={t("step3Title")} desc={t("step3Desc")} />
          </div>
        </div>
      </section>

      {/* MODELS */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("modelsTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("modelsSubtitle")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <ModelCard name={t("modelLiteName")} desc={t("modelLiteDesc")} tag="Lite" />
          <ModelCard name={t("model2Name")} desc={t("model2Desc")} tag="Pro" featured />
          <ModelCard name={t("modelProName")} desc={t("modelProDesc")} tag="Studio" />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
            {t("ctaTitle")}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">{t("ctaSubtitle")}</p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-brand-gradient text-white hover:opacity-90 shadow-glow"
          >
            <Link href={tPath("/fusion")}>
              <Sparkles className="mr-2 h-4 w-4" />
              {t("ctaButton")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function DemoPhoto({ label, color }: { label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className={`aspect-[3/4] rounded-lg bg-gradient-to-br ${color} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent_50%)]" />
        <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-medium">
          {label}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="glass-card hover:shadow-glow transition-shadow">
      <CardContent className="p-6">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary mb-4">
          {icon}
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function StepCard({
  num,
  icon,
  title,
  desc,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Card className="relative glass-card">
      <CardContent className="p-6">
        <div className="absolute top-4 right-4 text-5xl font-bold text-primary/10 leading-none">
          {num}
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-gradient text-white mb-4">
          {icon}
        </div>
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}

function ModelCard({
  name,
  desc,
  tag,
  featured = false,
}: {
  name: string;
  desc: string;
  tag: string;
  featured?: boolean;
}) {
  return (
    <Card
      className={
        featured
          ? "glass-card border-primary/40 shadow-glow"
          : "glass-card"
      }
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            {tag}
          </span>
          {featured && (
            <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 inline-flex items-center gap-1">
              <Check className="h-3 w-3" /> Popular
            </span>
          )}
        </div>
        <h3 className="font-semibold text-lg">{name}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </CardContent>
    </Card>
  );
}
