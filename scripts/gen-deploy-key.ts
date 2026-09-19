/**
 * Generate an ed25519 SSH keypair for GitHub deploy key.
 * Outputs the public key in OpenSSH format.
 */
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sshDir = join(homedir(), ".ssh");
mkdirSync(sshDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

// Convert PEM private key to OpenSSH format (minimal version)
// We'll just use the PEM format directly and wrap it; ssh client can use it.
const opensshPrivateKey = privateKey;

// Convert SPKI public key to OpenSSH format
// Format: ssh-ed25519 base64-pubkey comment
const spkiDer = Buffer.from(
  publicKey
    .replace("-----BEGIN PUBLIC KEY-----", "")
    .replace("-----END PUBLIC KEY-----", "")
    .replace(/\s/g, ""),
  "base64"
);

// For ed25519, the OpenSSH wire format is:
// 4 bytes length + "ssh-ed25519" + 4 bytes length + 32-byte public key
const pubKeyType = "ssh-ed25519";
const pubKeyBytes = spkiDer.subarray(-32); // last 32 bytes of SPKI for ed25519

const wireBuf = Buffer.alloc(4 + pubKeyType.length + 4 + pubKeyBytes.length);
let offset = 0;
wireBuf.writeUInt32BE(pubKeyType.length, offset); offset += 4;
wireBuf.write(pubKeyType, offset, "ascii"); offset += pubKeyType.length;
wireBuf.writeUInt32BE(pubKeyBytes.length, offset); offset += 4;
pubKeyBytes.copy(wireBuf, offset);

const opensshPublicKey = `ssh-ed25519 ${wireBuf.toString("base64")} allcombiner-deploy@sandbox`;

const privPath = join(sshDir, "allcombiner_deploy");
const pubPath = join(sshDir, "allcombiner_deploy.pub");

writeFileSync(privPath, opensshPrivateKey, { mode: 0o600 });
writeFileSync(pubPath, opensshPublicKey + "\n", { mode: 0o644 });

// Also write an SSH config snippet
const configPath = join(sshDir, "config");
const configContent = `Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/allcombiner_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
`;
writeFileSync(configPath, configContent, { mode: 0o600 });

console.log("=== CLÉ PUBLIQUE À COPIER SUR GITHUB ===\n");
console.log(opensshPublicKey);
console.log("\n=== Fichiers générés ===");
console.log(`Privée: ${privPath} (NE JAMAIS PARTAGER)`);
console.log(`Publique: ${pubPath}`);
console.log(`Config: ${configPath}`);
