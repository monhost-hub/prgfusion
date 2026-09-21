---
Task ID: pay-auth-001
Agent: main
Task: Sécuriser les checkouts Whop (auth obligatoire) + créditer 10 crédits pour le plan test $1 + box de résultat + push production

Work Log:
- Audit du composant PlanCheckoutButton : redirection /login déjà en place mais sans callbackUrl
- Audit de /api/checkout/whop : requireAuth() déjà présent (défense en profondeur OK)
- Audit du webhook /api/webhooks/whop : logique de crédit correcte, 1 crédit pour test plan
- Audit du CheckoutStatus (src/components/dashboard/checkout-status.tsx) : box de résultat déjà existante et complète (succès / échec / annulation / timeout / poll auto)
- Découverte : la box existe déjà — aucun nouveau composant à créer
- Modification 1 : src/lib/whop.ts → TEST_PLAN_CREDITS = 1 → 10
- Modification 2 : src/components/pricing/plan-checkout-button.tsx → ajout ?callbackUrl=/{locale}/pricing
- Modification 3 : src/components/auth/login-form.tsx → lecture + validation callbackUrl (anti open-redirect) + Suspense boundary
- Modification 4 : src/app/[locale]/login/page.tsx → wrapper <Suspense> pour useSearchParams
- Modification 5 : src/app/api/checkout/whop/route.ts → cancelUrl pointe vers /dashboard?checkout=cancelled
- Vérification TypeScript : aucune nouvelle erreur dans les 5 fichiers modifiés
- Commit créé : 8d407c5 (5 files, +64/-10)

Stage Summary:
- Commit : 8d407c5 "fix(payment): enforce auth before checkout + grant 10 credits on $1 test plan"
- Push : NON effectué (le sandbox n'a pas d'auth GitHub configurée)
- Action manuelle requise : `git push origin main` depuis un terminal authentifié
- Après push : Hostinger auto-deploy → db-init.ts exécute ALTER TABLE (planId NULL + planType column)
- Action manuelle critique après deploy : configurer le webhook Whop sur https://allcombiner.com/api/webhooks/whop
  (sans cela, aucun paiement ne déclenchera la crédit des crédits, même après le fix DB)

RISQUES ANALYSÉS :
- Open-redirect sur LoginForm : mitigé par safeCallbackUrl() (refuse // et URLs non-relative)
- MySQL ALTER TABLE idempotence : les ALTER sont MODIFY + ADD COLUMN IF NOT EXISTS, catch ignore les duplicates
- Pas de changement de schéma Prisma supplémentaire : schema.prisma déjà aligné avec db-init.ts

POST-DEPLOY CHECKLIST :
1. Vérifier dans phpMyAdmin que la colonne WhopPayment.planType existe
2. Vérifier que WhopPayment.planId est nullable (NULL allowed)
3. Configurer le webhook sur le dashboard Whop (URL: https://allcombiner.com/api/webhooks/whop, events: payment.succeeded, payment.failed, membership.activated, membership.deactivated)
4. Tester un paiement $1 → doit créditer 10 crédits → box "Paiement confirmé ! +10 crédits" sur /dashboard
5. Tester l'annulation → box "Paiement annulé" sur /dashboard
6. Tester un clic sur Starter sans être connecté → redirection /login?callbackUrl=/fr/pricing → après login retour /pricing
