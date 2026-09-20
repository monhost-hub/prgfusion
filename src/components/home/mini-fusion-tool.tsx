"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { Sparkles, ArrowRight, Upload, Cpu, Download, Check, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslatedPathname } from "@/i18n/routing";

export function MiniFusionTool() {
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
