"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslatedPathname } from "@/i18n/routing";

/**
 * PlanCheckoutButton — triggers a Whop checkout for a given plan.
 *
 * Behavior:
 *  1. If the user is not logged in → redirect to /login
 *  2. If logged in:
 *     a) If plan.whopCheckoutUrl is set → redirect DIRECTLY to that URL
 *        (faster, no server round-trip, works even if /api/checkout is down)
 *     b) Else → POST /api/checkout/whop with { planSlug }
 *        The server creates a Whop Checkout Session and returns a checkoutUrl
 *  3. The server (not the client) determines:
 *     - which Whop plan id to use (from DB)
 *     - the price (from DB)
 *     - the credits (from DB)
 *     - the user id (from session)
 *  4. After payment, Whop fires a webhook → /api/webhooks/whop grants credits
 *
 * IMPORTANT: We NEVER grant credits here. The "success" page only shows
 * "Payment is being processed" — credits are granted ONLY after the
 * authenticated webhook arrives.
 */
export function PlanCheckoutButton({
  planSlug,
  label,
  featured = false,
  whopCheckoutUrl,
}: {
  planSlug: string;
  label: string;
  featured?: boolean;
  /** Optional direct Whop checkout URL — if set, we skip the API call */
  whopCheckoutUrl?: string | null;
}) {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const tPath = useTranslatedPathname();

  async function handleClick() {
    // 1. Check auth
    if (status !== "authenticated") {
      toast.info("Connecte-toi pour t'abonner.");
      window.location.href = tPath("/login");
      return;
    }

    setLoading(true);

    // 2a. Direct redirect to Whop checkout URL (faster path)
    if (whopCheckoutUrl && /^https:\/\/(www\.)?whop\.com\//i.test(whopCheckoutUrl)) {
      window.location.href = whopCheckoutUrl;
      return;
    }

    // 2b. Otherwise, create a checkout session via the API
    try {
      const res = await fetch("/api/checkout/whop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json();

      if (!res.ok) {
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
    <Button
      onClick={handleClick}
      disabled={loading}
      size="sm"
      className={
        featured
          ? "w-full bg-brand-gradient text-white hover:opacity-90 shadow-glow border-2 border-transparent"
          : "w-full bg-primary/20 text-white border-2 border-primary/60 hover:bg-primary/30 hover:border-primary font-semibold shadow-sm"
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
  );
}
