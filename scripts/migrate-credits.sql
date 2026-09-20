-- =====================================================================
-- AllCombiner — Migration crédit + model selector
-- =====================================================================
-- À exécuter dans phpMyAdmin après le déploiement du nouveau code.
-- Cette migration :
--   1. Ajoute les colonnes manquantes (credits, creditCost, creditsUsed)
--   2. Crée la table CreditTransaction
--   3. Met à jour les 3 modèles avec leur creditCost (1, 2, 3)
--   4. Donne 9999 crédits à l'admin
--   5. Donne 3 crédits à tous les users existants (free tier bonus)
-- =====================================================================

-- === 1. Ajouter les colonnes manquantes ===
-- (db-init.ts le fait automatiquement au démarrage, mais on le fait aussi
-- ici pour être sûr)

ALTER TABLE `User` ADD COLUMN IF NOT EXISTS `credits` INT NOT NULL DEFAULT 3;
ALTER TABLE `AIModel` ADD COLUMN IF NOT EXISTS `creditCost` INT NOT NULL DEFAULT 1;
ALTER TABLE `Generation` ADD COLUMN IF NOT EXISTS `creditsUsed` INT NOT NULL DEFAULT 0;

-- === 2. Créer la table CreditTransaction ===
CREATE TABLE IF NOT EXISTS `CreditTransaction` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `amount` INT NOT NULL,
  `balance` INT NOT NULL,
  `reason` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CreditTransaction_userId_idx`(`userId`),
  INDEX `CreditTransaction_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CreditTransaction_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- === 3. Mettre à jour les creditCost des 3 modèles ===
UPDATE `AIModel` SET `creditCost` = 1 WHERE `name` = 'Nano Banana 2 Lite';
UPDATE `AIModel` SET `creditCost` = 2 WHERE `name` = 'Nano Banana 2';
UPDATE `AIModel` SET `creditCost` = 3 WHERE `name` = 'Nano Banana Pro';

-- === 4. Donner 9999 crédits à l'admin ===
UPDATE `User` SET `credits` = 9999 WHERE `role` = 'ADMIN';

-- === 5. Donner 3 crédits à tous les users existants (free tier) ===
-- (seulement à ceux qui ont 0 crédits — pour ne pas reset un solde existant)
UPDATE `User` SET `credits` = 3 WHERE `role` = 'USER' AND `credits` = 0;

-- === VÉRIFICATION ===
SELECT '=== Modèles avec creditCost ===' AS info;
SELECT `name`, `creditCost`, `enabled`, `isActive` FROM `AIModel` ORDER BY `createdAt` ASC;

SELECT '=== Users avec credits ===' AS info;
SELECT `email`, `role`, `credits` FROM `User` ORDER BY `role` DESC, `createdAt` ASC;

SELECT '=== Table CreditTransaction ===' AS info;
SELECT COUNT(*) AS transaction_count FROM `CreditTransaction`;
