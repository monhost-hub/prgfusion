"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Upload, X, RefreshCw, Sparkles, Download, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslatedPathname } from "@/i18n/routing";
import {
  ACCEPTED_MIME,
  ACCEPTED_EXT,
  maxUploadBytes,
  sniffImageMime,
} from "@/lib/upload";

interface UploadedImage {
  file: File;
  dataUrl: string;
  name: string;
}

const STEPS = ["progressUploading", "progressAnalyzing", "progressFusing", "progressRendering"] as const;

export function FusionPage() {
  const t = useTranslations("Fusion");
  const tCommon = useTranslations("Common");
  const tPath = useTranslatedPathname();
  const { data: session, status } = useSession();

  const [imageA, setImageA] = useState<UploadedImage | null>(null);
  const [imageB, setImageB] = useState<UploadedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client-side validation
  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxUploadBytes()) return t("errorFileSize");
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_EXT.some((ext) => lower.endsWith(ext))) return t("errorFileType");
      if (file.type && !ACCEPTED_MIME.includes(file.type.toLowerCase() as any)) {
        return t("errorFileType");
      }
      return null;
    },
    [t]
  );

  const handleUpload = useCallback(
    async (file: File, slot: "A" | "B") => {
      setError(null);
      const err = validateFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      // Magic-byte sniff
      const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      const mime = sniffImageMime(buf);
      if (!mime) {
        toast.error(t("errorFileType"));
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img: UploadedImage = { file, dataUrl, name: file.name };
      if (slot === "A") setImageA(img);
      else setImageB(img);
    },
    [validateFile, t]
  );

  const handleGenerate = async () => {
    setError(null);
    setResult(null);

    if (!imageA || !imageB) {
      setError(t("needBoth"));
      return;
    }
    if (status !== "authenticated") {
      setError(t("errorAuth"));
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setStep(0);

    // Simulated progress for UX (real progress would come from a websocket).
    const interval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.random() * 8 : p));
      setStep((s) => (s < 3 && Math.random() > 0.6 ? s + 1 : s));
    }, 800);

    try {
      const res = await fetch("/api/fusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageA: imageA.dataUrl,
          imageB: imageB.dataUrl,
        }),
      });

      clearInterval(interval);
      setProgress(100);
      setStep(3);

      const data = await res.json();
      if (!res.ok) {
        const msg =
          res.status === 401
            ? t("errorAuth")
            : res.status === 429
              ? t("errorRateLimit")
              : res.status === 503
                ? t("errorModel")
                : data?.error || t("errorGeneric");
        setError(msg);
        setProgress(0);
        setStep(0);
        return;
      }
      setResult(data.imageUrl);
      toast.success(t("result"));
    } catch (e) {
      clearInterval(interval);
      setError(t("errorGeneric"));
      setProgress(0);
      setStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setImageA(null);
    setImageB(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setStep(0);
  };

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <div className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      {/* Upload grid */}
      {!result && (
        <div className="max-w-5xl mx-auto">
          <div className="grid gap-6 md:grid-cols-2">
            <UploadSlot
              label={t("uploadA")}
              image={imageA}
              hint={t("uploadHint")}
              onUpload={(f) => handleUpload(f, "A")}
              onRemove={() => setImageA(null)}
            />
            <UploadSlot
              label={t("uploadB")}
              image={imageB}
              hint={t("uploadHint")}
              onUpload={(f) => handleUpload(f, "B")}
              onRemove={() => setImageB(null)}
            />
          </div>

          {/* Active model notice */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t("modelHint")}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-6 max-w-xl mx-auto flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Generate button */}
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={isGenerating || !imageA || !imageB || status !== "authenticated"}
              className="bg-brand-gradient text-white hover:opacity-90 shadow-glow min-w-[200px]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  {t("generating")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("generate")}
                </>
              )}
            </Button>
          </div>

          {/* Progress */}
          {isGenerating && (
            <div className="mt-8 max-w-xl mx-auto">
              <Progress value={progress} className="h-2" />
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {t(STEPS[step])} {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* Auth notice */}
          {status !== "authenticated" && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              <a href={tPath("/login")} className="text-primary hover:underline">
                {t("errorAuth")}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">{t("result")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("resultHint")}</p>
          </div>
          <Card className="glass-card">
            <CardContent className="p-4">
              <img
                src={result}
                alt={t("previewAlt")}
                className="w-full h-auto rounded-lg"
              />
            </CardContent>
          </Card>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg" className="bg-brand-gradient text-white hover:opacity-90">
              <a href={result} download={`allcombiner-${Date.now()}.png`}>
                <Download className="mr-2 h-4 w-4" />
                {t("downloadImage")}
              </a>
            </Button>
            <Button size="lg" variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("startOver")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadSlot({
  label,
  image,
  hint,
  onUpload,
  onRemove,
}: {
  label: string;
  image: UploadedImage | null;
  hint: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Fusion");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <Card
      className={`glass-card transition-all ${dragOver ? "border-primary border-2" : ""}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {image && (
            <Button size="sm" variant="ghost" onClick={onRemove} className="h-7 px-2 text-xs">
              <X className="mr-1 h-3 w-3" />
              {t("uploadRemove")}
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />

        {image ? (
          <div className="space-y-3">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={image.dataUrl} alt={image.name} className="w-full h-full object-cover" />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              {t("uploadReplace")}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) onUpload(f);
            }}
            className="w-full aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm">{t("uploadDrop")}</span>
            <span className="text-xs opacity-70 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {hint}
            </span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}
