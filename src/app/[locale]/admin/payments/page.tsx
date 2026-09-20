import { setRequestLocale, getTranslations } from "next-intl/server";
import { AdminPaymentsClient } from "@/components/admin/admin-payments-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  return (
    <AdminPaymentsClient
      labels={{
        title: "Paiements & Offres Whop",
        subtitle: "Gère les 4 abonnements, leurs prix, crédits et Plan IDs Whop. Modifie sans redéployer.",
        configStatus: "Statut Whop",
        configured: "Configuré",
        notConfigured: "Non configuré — définis WHOP_COMPANY_API_KEY et WHOP_WEBHOOK_SECRET dans .env",
        totalRevenue: "Revenu total",
        plansTitle: "Offres",
        plansSubtitle: "Modifie les prix, crédits, Plan IDs Whop. Sauvegarde → effet immédiat sur /pricing.",
        paymentsTitle: "Paiements récents",
        eventsTitle: "Événements webhook récents",
        colSlug: "Slug",
        colName: "Nom",
        colPrice: "Prix",
        colCredits: "Crédits",
        colWhopPlanId: "Whop Plan ID",
        colBilling: "Facturation",
        colEnabled: "Actif",
        colFeatured: "Populaire",
        colActions: "Actions",
        edit: "Modifier",
        history: "Historique",
        colDate: "Date",
        colUser: "Utilisateur",
        colPlan: "Plan",
        colAmount: "Montant",
        colStatus: "Statut",
        colEventType: "Type d'événement",
        colCreditsGranted: "Crédits accordés",
        colError: "Erreur",
        save: "Enregistrer",
        cancel: "Annuler",
        noData: "Aucune donnée",
      }}
    />
  );
}
