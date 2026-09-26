"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Upload, X, RefreshCw, Sparkles, Download, AlertCircle, Image as ImageIcon, Zap, Check, Coins } from "lucide-react";
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

/**
 * Converts an image File to a PNG data URL via Canvas, with optional
 * downscaling. This is required by the Nano Banana 2 model on OpenRouter:
 *   - PNG format only (not JPG/WEBP)
 *   - Max 1024×1024 to keep latency low and avoid payload limits
 *
 * Returns null if the file cannot be loaded as an image.
 */
async function convertToPngDataUrl(file: File, maxDim = 1024): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        // Downscale if larger than maxDim on either side
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        // White background to avoid transparency issues with JPEG sources
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // Force PNG output
        try {
          const pngDataUrl = canvas.toDataURL("image/png");
          resolve(pngDataUrl);
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
}

const STEPS = ["progressUploading", "progressAnalyzing", "progressFusing", "progressRendering"] as const;

/**
 * UI tier metadata — Quick / Studio / Precision.
 *
 * The /fusion page displays three commercial tiers mapped 1:1 to AIModel
 * rows by `creditCost` (1 / 2 / 3). The technical `name` (e.g. "Nano
 * Banana 2 Lite") is NEVER shown to the end user — only the commercial
 * tier name (Quick / Studio / Precision) and its description appear.
 *
 * The DB `id` is still sent to the backend as `modelId` so the backend
 * fetches the actual AIModel row (with its `providerId`) and calls
 * OpenRouter with the correct `providerModelId`. No silent substitution.
 *
 * If a model row has a `creditCost` not in {1, 2, 3}, returns null and
 * the row is hidden from the selector (defensive — should not happen
 * given the seed, but protects against admin misconfiguration).
 */
interface UiTier {
  uiName: string;
  uiDescription: string;
}

function getTierForCreditCost(
  creditCost: number,
  tFusion: (key: string) => string
): UiTier | null {
  if (creditCost === 1) {
    return {
      uiName: tFusion("tierQuick"),
      uiDescription: tFusion("tierQuickDesc"),
    };
  }
  if (creditCost === 2) {
    return {
      uiName: tFusion("tierStudio"),
      uiDescription: tFusion("tierStudioDesc"),
    };
  }
  if (creditCost === 3) {
    return {
      uiName: tFusion("tierPrecision"),
      uiDescription: tFusion("tierPrecisionDesc"),
    };
  }
  return null;
}

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

  // === Modèles IA + solde de crédits ===
  const [models, setModels] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    creditCost: number;
    isActive: boolean;
  }>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Fetch models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models) {
          setModels(data.models);
          // Default to the active model
          const active = data.models.find((m: any) => m.isActive);
          setSelectedModelId(active?.id ?? data.models[0]?.id ?? null);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch user credits when authenticated
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/credits")
        .then((r) => r.json())
        .then((data) => {
          if (typeof data.credits === "number") {
            setUserCredits(data.credits);
          }
        })
        .catch(() => {});
    }
  }, [status]);

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const creditCost = selectedModel?.creditCost ?? 1;
  const insufficientCredits = userCredits !== null && userCredits < creditCost;

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

      // Convert to PNG via Canvas, downscale to max 1024px on the longest side.
      // This is required by the Nano Banana 2 model (see /docs/api doc):
      //   - PNG format (not JPG/WEBP)
      //   - Max 1024×1024 to keep latency low (~9s) and avoid payload limits
      //   - Data URL base64 sent to backend as image_url
      const pngDataUrl = await convertToPngDataUrl(file, 1024);
      if (!pngDataUrl) {
        toast.error(t("errorFileType"));
        return;
      }

      const img: UploadedImage = { file, dataUrl: pngDataUrl, name: file.name };
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
          modelId: selectedModelId, // ← send the user's chosen model
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
            : res.status === 402
              ? t("errorInsufficientCredits")
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
      // Update local credit balance from the server response
      if (typeof data.balanceAfter === "number") {
        setUserCredits(data.balanceAfter);
      }
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

          {/* === Modèle IA + solde de crédits === */}
          <div className="mt-8 max-w-3xl mx-auto">
            {/* Solde de crédits */}
            {userCredits !== null && (
              <div className="flex items-center justify-center gap-2 mb-4 text-sm">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Ton solde :</span>
                <span className={`font-bold ${userCredits > 0 ? "text-emerald-500" : "text-destructive"}`}>
                  {userCredits} crédit{userCredits > 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Sélecteur de modèle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {models.map((m) => {
                // Map the DB model row to a UI tier (Quick / Studio / Precision)
                // based on its `creditCost`. Models with an unknown creditCost
                // (not 1/2/3) are hidden from the selector — defensive guard
                // against admin misconfiguration.
                const tier = getTierForCreditCost(m.creditCost, t);
                if (!tier) {
                  return null;
                }
                const isSelected = m.id === selectedModelId;
                const canAfford = userCredits === null || userCredits >= m.creditCost;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModelId(m.id)}
                    disabled={isGenerating}
                    className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border/60 bg-card hover:border-primary/40"
                    } ${!canAfford ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">{tier.uiName}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {tier.uiDescription}
                    </p>
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                      <Coins className="h-3 w-3" />
                      {m.creditCost} crédit{m.creditCost > 1 ? "s" : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Alerte solde insuffisant */}
            {insufficientCredits && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Crédits insuffisants pour ce modèle. Il te faut {creditCost} crédit{creditCost > 1 ? "s" : ""}, tu en as {userCredits}.
                </span>
              </div>
            )}
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
              disabled={isGenerating || !imageA || !imageB || status !== "authenticated" || insufficientCredits || !selectedModelId}
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
