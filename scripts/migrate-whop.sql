-- =====================================================================
-- AllCombiner — Migration Whop (paiements + gestion offres)
-- =====================================================================
-- À exécuter dans phpMyAdmin APRÈS le déploiement du nouveau code.
--
-- Cette migration :
--   1. Ajoute les colonnes Whop à la table PricingPlan
--   2. Crée les tables WhopEvent, WhopPayment, PricingPlanChange
--   3. Met à jour les 4 plans d'abonnement avec leur whopPlanId
--   4. Change la devise par défaut de USD → EUR
--
-- Toutes les opérations sont idempotentes (ALTER ... ADD COLUMN IF NOT EXISTS,
-- CREATE TABLE IF NOT EXISTS, UPDATE conditionnel).
-- =====================================================================

-- === 1. Ajouter les colonnes Whop à PricingPlan ===
ALTER TABLE `PricingPlan` ADD COLUMN IF NOT EXISTS `whopPlanId` VARCHAR(191) NULL;
ALTER TABLE `PricingPlan` ADD COLUMN IF NOT EXISTS `whopCheckoutUrl` LONGTEXT NULL;
ALTER TABLE `PricingPlan` ADD COLUMN IF NOT EXISTS `billingPeriod` VARCHAR(191) NULL;

-- === 2. Migrer la devise de USD → EUR ===
UPDATE `PricingPlan` SET `currency` = 'EUR' WHERE `currency` = 'USD' OR `currency` IS NULL;

-- === 3. Mettre à jour les 4 plans d'abonnement avec leur whopPlanId ===
UPDATE `PricingPlan` SET `whopPlanId` = 'plan_CfZL537w2pKOn', `billingPeriod` = 'monthly' WHERE `slug` = 'sub_starter';
UPDATE `PricingPlan` SET `whopPlanId` = 'plan_ljP4MuzoKR235', `billingPeriod` = 'monthly' WHERE `slug` = 'sub_creator';
UPDATE `PricingPlan` SET `whopPlanId` = 'plan_iZlkOxrRs9OHY', `billingPeriod` = 'monthly' WHERE `slug` = 'sub_pro';
UPDATE `PricingPlan` SET `whopPlanId` = 'plan_Gk5R2N2OViuiK', `billingPeriod` = 'monthly' WHERE `slug` = 'sub_business';

-- Mettre billingPeriod = 'one_time' pour les recharges
UPDATE `PricingPlan` SET `billingPeriod` = 'one_time' WHERE `slug` LIKE 'recharge_%' AND `billingPeriod` IS NULL;

-- === 4. Créer la table WhopEvent (idempotence — UNIQUE sur whopEventId) ===
CREATE TABLE IF NOT EXISTS `WhopEvent` (
  `id` VARCHAR(191) NOT NULL,
  `whopEventId` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `whopPaymentId` VARCHAR(191) NULL,
  `whopMembershipId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `planSlug` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL,
  `creditsGranted` INT NOT NULL DEFAULT 0,
  `rawPayload` LONGTEXT NOT NULL,
  `error` TEXT NULL,
  `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `WhopEvent_whopEventId_key`(`whopEventId`),
  INDEX `WhopEvent_userId_idx`(`userId`),
  INDEX `WhopEvent_eventType_idx`(`eventType`),
  INDEX `WhopEvent_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- === 5. Créer la table WhopPayment (UNIQUE sur whopPaymentId) ===
CREATE TABLE IF NOT EXISTS `WhopPayment` (
  `id` VARCHAR(191) NOT NULL,
  `whopPaymentId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `planId` VARCHAR(191) NOT NULL,
  `whopEventId` VARCHAR(191) NULL,
  `amount` DOUBLE NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'EUR',
  `credits` INT NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `whopMembershipId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `WhopPayment_whopPaymentId_key`(`whopPaymentId`),
  INDEX `WhopPayment_userId_idx`(`userId`),
  INDEX `WhopPayment_status_idx`(`status`),
  INDEX `WhopPayment_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `WhopPayment_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `PricingPlan`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- === 6. Créer la table PricingPlanChange (historique des modifs admin) ===
CREATE TABLE IF NOT EXISTS `PricingPlanChange` (
  `id` VARCHAR(191) NOT NULL,
  `planId` VARCHAR(191) NOT NULL,
  `adminId` VARCHAR(191) NOT NULL,
  `field` VARCHAR(191) NOT NULL,
  `oldValue` TEXT NULL,
  `newValue` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PricingPlanChange_planId_idx`(`planId`),
  INDEX `PricingPlanChange_adminId_idx`(`adminId`),
  INDEX `PricingPlanChange_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PricingPlanChange_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `PricingPlan`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- === VÉRIFICATION ===
SELECT '=== PricingPlan avec colonnes Whop ===' AS info;
SELECT `slug`, `currency`, `credits`, `whopPlanId`, `billingPeriod`, `enabled` FROM `PricingPlan` ORDER BY `sortOrder` ASC;

SELECT '=== Tables Whop créées ===' AS info;
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('WhopEvent', 'WhopPayment', 'PricingPlanChange');
