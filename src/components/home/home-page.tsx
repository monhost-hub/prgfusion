"use client";

import Link from "next/link";
import { Sparkles, Users, Scan, Handshake, Camera, ArrowRight, Upload, Cpu, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MiniFusionToolLazy } from "./mini-fusion-tool-lazy";
import type { Locale } from "@/i18n/routing";

/**
 * HomePage — Server Component.
 *
 * Renders all static sections (hero text, trust, how it works, models, CTA)
 * server-side. The MiniFusionTool is lazy-loaded client-side.
 */
export function HomePage({
  locale,
  strings,
}: {
  locale: Locale;
  strings: {
    heroBadge: string;
    heroTitle: string;
    heroSubtitle: string;
    heroCtaPrimary: string;
    heroCtaSecondary: string;
    heroNoCreditCard: string;
    trustTitle: string;
    trustSubtitle: string;
    trust1Title: string;
    trust1Desc: string;
    trust2Title: string;
    trust2Desc: string;
    trust3Title: string;
    trust3Desc: string;
    trust4Title: string;
    trust4Desc: string;
    howTitle: string;
    howSubtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    modelsTitle: string;
    modelsSubtitle: string;
    modelLiteName: string;
    modelLiteDesc: string;
    model2Name: string;
    model2Desc: string;
    modelProName: string;
    modelProDesc: string;
    ctaTitle: string;
    ctaSubtitle: string;
    ctaButton: string;
  };
}) {
  const s = strings;

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative overflow-hidden hero-glow bg-dot-grid">
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-32 md:pb-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              {s.heroBadge}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              {s.heroTitle}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              {s.heroSubtitle}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                asChild
                size="lg"
                className="bg-brand-gradient text-white hover:opacity-90 shadow-glow"
              >
                <Link href={`/${locale}/fusion`}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {s.heroCtaPrimary}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/${locale}/pricing`}>{s.heroCtaSecondary}</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{s.heroNoCreditCard}</p>
          </div>

          {/* MiniFusionTool — lazy-loaded client component */}
          <div className="mt-16 md:mt-24 max-w-4xl mx-auto">
            <MiniFusionToolLazy />
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{s.trustTitle}</h2>
          <p className="mt-3 text-muted-foreground">{s.trustSubtitle}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard icon={<Scan className="h-5 w-5" />} title={s.trust1Title} desc={s.trust1Desc} />
          <FeatureCard icon={<Users className="h-5 w-5" />} title={s.trust2Title} desc={s.trust2Desc} />
          <FeatureCard icon={<Handshake className="h-5 w-5" />} title={s.trust3Title} desc={s.trust3Desc} />
          <FeatureCard icon={<Camera className="h-5 w-5" />} title={s.trust4Title} desc={s.trust4Desc} />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-muted/30 border-y border-border/40">
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{s.howTitle}</h2>
            <p className="mt-3 text-muted-foreground">{s.howSubtitle}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            <StepCard num={1} icon={<Upload className="h-5 w-5" />} title={s.step1Title} desc={s.step1Desc} />
            <StepCard num={2} icon={<Cpu className="h-5 w-5" />} title={s.step2Title} desc={s.step2Desc} />
            <StepCard num={3} icon={<Download className="h-5 w-5" />} title={s.step3Title} desc={s.step3Desc} />
          </div>
        </div>
      </section>

      {/* MODELS */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{s.modelsTitle}</h2>
          <p className="mt-3 text-muted-foreground">{s.modelsSubtitle}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <ModelCard name={s.modelLiteName} desc={s.modelLiteDesc} tag="Lite" />
          <ModelCard name={s.model2Name} desc={s.model2Desc} tag="Pro" featured />
          <ModelCard name={s.modelProName} desc={s.modelProDesc} tag="Studio" />
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-amber-500/10 p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
            {s.ctaTitle}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">{s.ctaSubtitle}</p>
          <Button
            asChild
            size="lg"
            className="mt-8 bg-brand-gradient text-white hover:opacity-90 shadow-glow"
          >
            <Link href={`/${locale}/fusion`}>
              <Sparkles className="mr-2 h-4 w-4" />
              {s.ctaButton}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
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
