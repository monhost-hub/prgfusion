-- =====================================================================
-- AllCombiner — Nettoyage des doublons + ajout recharges Whop
-- =====================================================================
-- À exécuter dans phpMyAdmin APRÈS le déploiement du nouveau code.
--
-- Cette migration :
--   1. Désactive les anciens plans en doublon (free, starter, pro, business)
--      → ils ne seront plus visibles ni dans l'admin ni sur /pricing
--   2. Met à jour les 5 recharges avec leur whopPlanId + whopCheckoutUrl
--   3. Synchronise les prix et crédits des 4 abonnements (au cas où)
-- =====================================================================

-- === 1. Désactiver les anciens plans en doublon ===
-- Ces slugs (sans préfixe sub_/recharge_) viennent de l'ancienne grille
-- 4-plans d'origine. Ils sont remplacés par sub_starter, sub_creator, etc.
UPDATE `PricingPlan` SET `enabled` = 0
WHERE `slug` IN ('free', 'starter', 'pro', 'business')
  AND `slug` NOT LIKE 'sub\_%'
  AND `slug` NOT LIKE 'recharge\_%';

-- === 2. Mettre à jour les 5 recharges avec leur Plan ID + Checkout URL Whop ===
UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_p5X53jTXOIYqp',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_p5X53jTXOIYqp',
  `billingPeriod` = 'one_time',
  `currency` = 'EUR'
WHERE `slug` = 'recharge_mini';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_K0XdfjjXukUN3',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_K0XdfjjXukUN3',
  `billingPeriod` = 'one_time',
  `currency` = 'EUR'
WHERE `slug` = 'recharge_small';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_1v1cg4NMkpLfZ',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_1v1cg4NMkpLfZ',
  `billingPeriod` = 'one_time',
  `currency` = 'EUR'
WHERE `slug` = 'recharge_medium';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_ABI1GWRWr9DLV',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_ABI1GWRWr9DLV',
  `billingPeriod` = 'one_time',
  `currency` = 'EUR'
WHERE `slug` = 'recharge_large';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_6Ga9zlu7SFTdd',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_6Ga9zlu7SFTdd',
  `billingPeriod` = 'one_time',
  `currency` = 'EUR'
WHERE `slug` = 'recharge_xl';

-- === 3. Synchroniser les 4 abonnements avec Checkout URL directe ===
UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_CfZL537w2pKOn',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_CfZL537w2pKOn',
  `billingPeriod` = 'monthly',
  `currency` = 'EUR',
  `priceMonthly` = 9.99,
  `credits` = 30
WHERE `slug` = 'sub_starter';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_ljP4MuzoKR235',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_ljP4MuzoKR235',
  `billingPeriod` = 'monthly',
  `currency` = 'EUR',
  `priceMonthly` = 24.99,
  `credits` = 100
WHERE `slug` = 'sub_creator';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_iZlkOxrRs9OHY',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_iZlkOxrRs9OHY',
  `billingPeriod` = 'monthly',
  `currency` = 'EUR',
  `priceMonthly` = 49.99,
  `credits` = 250
WHERE `slug` = 'sub_pro';

UPDATE `PricingPlan` SET
  `whopPlanId` = 'plan_Gk5R2N2OViuiK',
  `whopCheckoutUrl` = 'https://whop.com/checkout/plan_Gk5R2N2OViuiK',
  `billingPeriod` = 'monthly',
  `currency` = 'EUR',
  `priceMonthly` = 99.99,
  `credits` = 500
WHERE `slug` = 'sub_business';

-- === VÉRIFICATION ===
SELECT '=== Plans actifs (enabled=1) après nettoyage ===' AS info;
SELECT `slug`, `currency`, `priceMonthly`, `credits`, `whopPlanId`, `billingPeriod`, `enabled`
FROM `PricingPlan`
WHERE `enabled` = 1
ORDER BY `sortOrder` ASC;

SELECT '=== Plans désactivés (legacy) ===' AS info;
SELECT `slug`, `enabled`
FROM `PricingPlan`
WHERE `enabled` = 0
ORDER BY `sortOrder` ASC;
