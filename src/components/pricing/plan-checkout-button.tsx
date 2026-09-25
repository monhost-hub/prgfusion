"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslatedPathname } from "@/i18n/routing";
import { EmailVerificationDialog } from "@/components/auth/email-verification-dialog";

/**
 * PlanCheckoutButton — triggers a Whop checkout for a given plan.
 *
 * Behavior:
 *  1. If the user is not logged in → redirect to /login
 *  2. If logged in → POST /api/checkout/whop with { planSlug }
 *     The server creates a Whop Checkout Session with metadata.userId
 *  3. The server (not the client) determines:
 *     - which Whop plan id to use (from DB)
 *     - the price (from DB)
 *     - the credits (from DB)
 *     - the user id (from session)
 *  4. After payment, Whop fires a webhook → /api/webhooks/whop grants credits
 *
 * EMAIL_NOT_VERIFIED handling:
 *  If the server returns 403 with { code: "EMAIL_NOT_VERIFIED" }, instead of
 *  showing a raw toast error, we display the EmailVerificationDialog modal.
 *
 * IMPORTANT: We NEVER grant credits here. The "success" page only shows
 * "Payment is being processed" — credits are granted ONLY after the
 * authenticated webhook arrives.
 */
export function PlanCheckoutButton({
  planSlug,
  label,
  featured = false,
}: {
  planSlug: string;
  label: string;
  featured?: boolean;
}) {
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const tPath = useTranslatedPathname();

  // Determine context: subscription vs recharge based on slug prefix
  const verifyContext = planSlug.startsWith("sub_") ? "subscription" : "recharge";

  async function handleClick() {
    // 1. Check auth — if not authenticated, redirect to /login
    if (status !== "authenticated") {
      // For non-authenticated users, show the dialog too (with signup/login CTAs)
      setShowVerifyDialog(true);
      return;
    }

    setLoading(true);

    // 2. Create a checkout session via the API
    try {
      const res = await fetch("/api/checkout/whop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Check for EMAIL_NOT_VERIFIED — show modal instead of toast
        if (res.status === 403) {
          let parsed: any = null;
          try { parsed = JSON.parse(data?.error || ""); } catch {}
          if (parsed?.code === "EMAIL_NOT_VERIFIED") {
            setShowVerifyDialog(true);
            return;
          }
        }

        // Other errors — show toast
        const msg =
          res.status === 401 ? "Connecte-toi pour t'abonner."
          : res.status === 404 ? "Plan introuvable."
          : res.status === 400 ? data?.error || "Plan non disponible au paiement."
          : res.status === 503 ? "Paiements temporairement indisponibles."
          : data?.error || "Erreur lors de la création de la session de paiement.";
        toast.error(msg);
        return;
      }

      // 3. Redirect to Whop checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("URL de paiement manquante.");
      }
    } catch (err) {
      toast.error("Erreur réseau. Réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        size="sm"
        className={
          featured
            ? "w-full !bg-brand-gradient !text-white !border-2 !border-transparent hover:opacity-90 shadow-glow"
            : "w-full !bg-primary/25 !text-white !border-2 !border-primary hover:!bg-primary/40 hover:!border-primary font-semibold shadow-sm"
        }
        variant={featured ? "default" : "outline"}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Redirection…
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            {label}
          </>
        )}
      </Button>

      <EmailVerificationDialog
        open={showVerifyDialog}
        onOpenChange={setShowVerifyDialog}
        context={verifyContext}
      />
    </>
  );
}
