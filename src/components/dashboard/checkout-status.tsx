"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, Coins, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * CheckoutStatus — handles the return from Whop checkout.
 *
 * After a user pays on Whop, they're redirected back to /dashboard?checkout=success
 * (or ?checkout=cancelled, ?checkout=error).
 *
 * IMPORTANT: The "?status=success" URL parameter is NOT proof of payment.
 * Whop explicitly says: "After a redirect, check the status query parameter:
 * success = The payment succeeded. Use the receipt information to render a
 * success page."
 *
 * But the ACTUAL credit grant happens via the webhook (/api/webhooks/whop),
 * which can arrive 1-10 seconds AFTER the user is redirected back. So:
 *
 * 1. If checkout=success → show "Paiement en cours de traitement"
 * 2. Poll /api/user/credits every 2s for up to 60s
 * 3. When the balance increases → show "Paiement confirmé ! +X crédits"
 * 4. If checkout=cancelled → show "Paiement annulé"
 * 5. If checkout=error → show "Erreur de paiement"
 *
 * This component NEVER grants credits — it only displays the status.
 * Credits are granted exclusively by the webhook after signature verification.
 */
export function CheckoutStatus({ initialCredits }: { initialCredits: number }) {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout"); // success | cancelled | error

  const [status, setStatus] = useState<"idle" | "processing" | "confirmed" | "cancelled" | "error" | "timeout">(
    checkoutStatus === "success" ? "processing"
    : checkoutStatus === "cancelled" ? "cancelled"
    : checkoutStatus === "error" ? "error"
    : "idle"
  );
  const [currentCredits, setCurrentCredits] = useState(initialCredits);
  const [creditsGained, setCreditsGained] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const initialCreditsRef = useRef(initialCredits);

  // Auto-refresh credits every 2s for up to 60s when processing
  useEffect(() => {
    if (status !== "processing") return;

    let attempts = 0;
    const maxAttempts = 30; // 30 × 2s = 60s max

    const interval = setInterval(async () => {
      attempts++;
      setElapsed(attempts * 2);

      try {
        const res = await fetch("/api/user/credits");
        if (!res.ok) return;
        const data = await res.json();
        const newCredits = typeof data.credits === "number" ? data.credits : null;
        if (newCredits === null) return;

        setCurrentCredits(newCredits);

        // Did the balance increase since the page load?
        if (newCredits > initialCreditsRef.current) {
          setCreditsGained(newCredits - initialCreditsRef.current);
          setStatus("confirmed");
          clearInterval(interval);
          return;
        }

        // Timeout — webhook hasn't arrived in 60s
        if (attempts >= maxAttempts) {
          setStatus("timeout");
          clearInterval(interval);
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [status]);

  // If no checkout param, render nothing
  if (status === "idle") return null;

  return (
    <Card
      className={
        status === "confirmed"
          ? "glass-card border-emerald-500/40 shadow-glow mb-6"
          : status === "error" || status === "cancelled"
            ? "glass-card border-destructive/40 mb-6"
            : status === "timeout"
              ? "glass-card border-amber-500/40 mb-6"
              : "glass-card border-amber-500/40 mb-6"
      }
    >
      <CardContent className="p-5">
        {status === "processing" && (
          <div className="flex items-start gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-base">Paiement en cours de traitement…</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ton paiement a été initié. Tes crédits seront activés dans quelques secondes,
                dès que la confirmation bancaire arrivera.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Vérification en cours… ({elapsed}s)
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Solde actuel :</span>
                <span className="font-bold">{currentCredits}</span>
              </div>
            </div>
          </div>
        )}

        {status === "confirmed" && creditsGained !== null && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-base text-emerald-600 dark:text-emerald-400">
                Paiement confirmé ! 🎉
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{creditsGained} crédits</span>
                {" "}viennent d'être ajoutés à ton compte.
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Nouveau solde :</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentCredits}</span>
              </div>
              <Button asChild size="sm" className="mt-3 bg-brand-gradient text-white hover:opacity-90">
                <Link href="/fr/fusion">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Lancer une fusion
                </Link>
              </Button>
            </div>
          </div>
        )}

        {status === "confirmed" && creditsGained === null && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-base text-emerald-600 dark:text-emerald-400">
                Solde mis à jour
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ton solde a été actualisé.
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="font-bold">{currentCredits} crédits</span>
              </div>
            </div>
          </div>
        )}

        {status === "timeout" && (
          <div className="flex items-start gap-3">
            <Loader2 className="h-6 w-6 text-amber-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-base">Paiement en attente de confirmation</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ton paiement a été initié mais la confirmation bancaire prend plus de temps que prévu.
                Pas d'inquiétude — tes crédits seront ajoutés automatiquement dès réception du webhook
                (généralement dans les 5 minutes).
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Tu peux recharger cette page dans quelques minutes pour vérifier ton solde.
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Coins className="h-4 w-4 text-amber-500" />
                <span className="text-muted-foreground">Solde actuel :</span>
                <span className="font-bold">{currentCredits}</span>
              </div>
            </div>
          </div>
        )}

        {status === "cancelled" && (
          <div className="flex items-start gap-3">
            <XCircle className="h-6 w-6 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-base">Paiement annulé</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Tu as annulé le paiement. Aucun crédit n'a été débité.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-3">
            <XCircle className="h-6 w-6 text-destructive mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-base">Erreur de paiement</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Le paiement n'a pas pu aboutir. Réessaie ou contacte le support
                si le problème persiste.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
