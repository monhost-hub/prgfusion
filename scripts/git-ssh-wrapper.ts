/**
 * git-ssh-wrapper: a minimal SSH transport for git that uses ssh2 instead of
 * the system ssh client (which isn't available in this sandbox).
 *
 * Git invokes the SSH helper as: <cmd> [-p port] <username@host> <git-command>
 * e.g. `bun git-ssh-wrapper.ts git@github.com "git-upload-pack 'Akaprod/allcombiner.git'"
 */
import { readFileSync } from "node:fs";
import { Client } from "ssh2";

// Parse args
const args = process.argv.slice(2);
console.error("[git-ssh-wrapper] args:", args.join(" "));

let port = 22;
let hostArg = "";
let gitCommand = "";
const rest: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "-p") {
    port = parseInt(args[i + 1], 10);
    i++;
  } else {
    rest.push(a);
  }
}

// Last arg = git command, second-to-last = user@host
if (rest.length >= 2) {
  hostArg = rest[rest.length - 2];
  gitCommand = rest[rest.length - 1];
} else if (rest.length === 1) {
  // Only one arg — could be the host (with command on stdin)? unlikely for git
  console.error("[git-ssh-wrapper] not enough args");
  process.exit(1);
}

// Parse user@host
let user = "git";
let host = hostArg;
if (hostArg.includes("@")) {
  const parts = hostArg.split("@");
  user = parts[0];
  host = parts[1];
}

console.error(`[git-ssh-wrapper] user=${user} host=${host} port=${port}`);
console.error(`[git-ssh-wrapper] cmd=${gitCommand}`);

const keyPath = process.env.GIT_SSH_KEY || "/home/z/.ssh/allcombiner_deploy";
const privateKey = readFileSync(keyPath, "utf-8");

const conn = new Client();
conn.on("ready", () => {
  console.error("[git-ssh-wrapper] SSH ready, exec...");
  conn.exec(gitCommand, { pty: false }, (err, stream) => {
    if (err) {
      console.error(`[git-ssh-wrapper] exec error: ${err.message}`);
      process.exit(1);
    }
    process.stdin.pipe(stream.stdin);
    stream.stdout.pipe(process.stdout);
    stream.stderr.pipe(process.stderr);
    stream.on("close", (code: number) => {
      console.error(`[git-ssh-wrapper] stream closed, code=${code}`);
      conn.end();
      process.exit(code || 0);
    });
  });
});
conn.on("error", (err: Error) => {
  console.error(`[git-ssh-wrapper] SSH error: ${err.message}`);
  process.exit(1);
});
conn.connect({
  host,
  port,
  username: user,
  privateKey,
  readyTimeout: 20000,
});
