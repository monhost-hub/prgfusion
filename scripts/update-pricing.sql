-- =====================================================================
-- AllCombiner — Mise à jour de la table PricingPlan
-- =====================================================================
-- 1. Désactive tous les anciens plans (slug sans préfixe sub_/recharge_)
-- 2. Les nouveaux plans (sub_*, recharge_*) seront créés automatiquement
--    au prochain démarrage du serveur par db-init.ts
-- =====================================================================

-- Désactiver les anciens plans (ils n'apparaîtront plus sur /pricing)
UPDATE `PricingPlan`
SET `enabled` = 0
WHERE `slug` IN ('free', 'starter', 'pro', 'business')
  AND `slug` NOT LIKE 'sub\_%'
  AND `slug` NOT LIKE 'recharge\_%';

-- Vérification : afficher tous les plans restants actifs
SELECT `slug`, `nameJson`, `priceMonthly`, `credits`, `enabled`, `sortOrder`
FROM `PricingPlan`
WHERE `enabled` = 1
ORDER BY `sortOrder` ASC;
