/**
 * Generate SSH keypair using ssh2's own generateKeyPairSync (proper OpenSSH format).
 */
import { utils } from "ssh2";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sshDir = join(homedir(), ".ssh");
mkdirSync(sshDir, { recursive: true });

// Generate ed25519 keypair in OpenSSH format using ssh2's utility
const keys = (utils as any).generateKeyPairSync("ed25519", {
  comment: "allcombiner-deploy@sandbox",
});

const opensshPrivateKey = String(keys.private);
const opensshPublicKey = String(keys.public).trim();

const privPath = join(sshDir, "allcombiner_deploy");
const pubPath = join(sshDir, "allcombiner_deploy.pub");

writeFileSync(privPath, opensshPrivateKey, { mode: 0o600 });
writeFileSync(pubPath, opensshPublicKey + "\n", { mode: 0o644 });

console.log("=== NOUVELLE CLÉ PUBLIQUE À COPIER SUR GITHUB ===\n");
console.log(opensshPublicKey);
console.log("\n=== Fichiers régénérés (format OpenSSH valide) ===");
console.log(`Privée: ${privPath}`);
console.log(`Publique: ${pubPath}`);
