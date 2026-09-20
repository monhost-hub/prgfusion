"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { Sparkles, Users, Scan, Handshake, Camera, ArrowRight, Upload, Cpu, Download, Check, X, RefreshCw } from "lucide-react";
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

          {/* Visual: REAL mini fusion tool */}
          <div className="mt-16 md:mt-24 max-w-4xl mx-auto">
            <MiniFusionTool />
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

/**
 * Mini fusion tool — real, functional, embedded in the home page hero.
 * Lets users upload Photo A + Photo B and run a fusion right from the home
 * page. If the user is not authenticated, redirects to /fusion (the full
 * page tool, which itself redirects to /login if needed).
 */
function MiniFusionTool() {
  const t = useTranslations("Home");
  const tFusion = useTranslations("Fusion");
  const tPath = useTranslatedPathname();
  const { data: session, status } = useSession();

  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);

  // Convert uploaded file → PNG data URL (max 1024px), matching the
  // pipeline used by the full /fusion page.
  const convertToPng = useCallback(async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        const img = new window.Image();
        img.onload = () => {
          let { width, height } = img;
          const maxDim = 1024;
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          try {
            resolve(canvas.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleUpload = async (file: File, slot: "A" | "B") => {
    setError(null);
    setResult(null);
    const lower = file.name.toLowerCase();
    if (!/\.(jpg|jpeg|png|webp)$/.test(lower)) {
      toast.error(tFusion("errorFileType"));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error(tFusion("errorFileSize"));
      return;
    }
    const dataUrl = await convertToPng(file);
    if (!dataUrl) {
      toast.error(tFusion("errorFileType"));
      return;
    }
    if (slot === "A") setImageA(dataUrl);
    else setImageB(dataUrl);
  };

  const handleGenerate = async () => {
    setError(null);
    setResult(null);

    if (!imageA || !imageB) {
      setError(tFusion("needBoth"));
      return;
    }

    if (status !== "authenticated") {
      window.location.href = tPath("/fusion");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageA, imageB }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          res.status === 401 ? tFusion("errorAuth")
          : res.status === 429 ? tFusion("errorRateLimit")
          : res.status === 503 ? tFusion("errorModel")
          : data?.error || tFusion("errorGeneric");
        setError(msg);
        return;
      }
      setResult(data.imageUrl);
      toast.success(tFusion("result"));
    } catch {
      setError(tFusion("errorGeneric"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setImageA(null);
    setImageB(null);
    setResult(null);
    setError(null);
  };

  if (result) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 backdrop-blur">
        <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
          <img src={result} alt={tFusion("previewAlt")} className="w-full h-full object-contain" />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Button asChild size="sm" className="bg-brand-gradient text-white hover:opacity-90">
            <a href={result} download={`allcombiner-${Date.now()}.png`}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {tFusion("downloadImage")}
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {tFusion("startOver")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
        <MiniUploadSlot
          label="Photo A"
          color="from-emerald-500 to-teal-500"
          image={imageA}
          onUpload={(f) => handleUpload(f, "A")}
          onRemove={() => setImageA(null)}
          inputRef={inputARef}
        />
        <div className="hidden md:flex flex-col items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">AllCombiner</span>
        </div>
        <MiniUploadSlot
          label="Photo B"
          color="from-amber-500 to-rose-500"
          image={imageB}
          onUpload={(f) => handleUpload(f, "B")}
          onRemove={() => setImageB(null)}
          inputRef={inputBRef}
        />
      </div>

      {error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !imageA || !imageB}
          className="bg-brand-gradient text-white hover:opacity-90 shadow-glow"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {tFusion("generating")}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              {t("heroCtaPrimary")}
            </>
          )}
        </Button>
        <Button asChild variant="outline">
          <Link href={tPath("/fusion")}>
            {t("ctaButton")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {!session && (
        <p className="text-center text-xs text-muted-foreground">
          {tFusion("modelHint")} · <Link href={tPath("/login")} className="text-primary hover:underline">{tFusion("errorAuth")}</Link>
        </p>
      )}
    </div>
  );
}

function MiniUploadSlot({
  label,
  color,
  image,
  onUpload,
  onRemove,
  inputRef,
}: {
  label: string;
  color: string;
  image: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = "";
        }}
      />
      {image ? (
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border/60 bg-card shadow-sm">
          <img src={image} alt={label} className="w-full h-full object-cover" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className="rounded bg-black/60 text-white text-xs px-2 py-0.5">{label}</span>
            <button
              onClick={onRemove}
              className="rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) onUpload(f);
          }}
          className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 text-white bg-gradient-to-br ${color} ${dragOver ? "border-white scale-105" : "border-white/40 hover:border-white/80"}`}
        >
          <Upload className="h-6 w-6" />
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[10px] opacity-80">JPG · PNG · WEBP</span>
        </button>
      )}
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
