import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const tunnelConfig = path.join(
  projectRoot,
  "ops",
  "kuku-cloudflare-tunnel.yml",
);

const lanServer = spawn("npm", ["run", "dev:lan"], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});
const tunnel = spawn(
  "cloudflared",
  ["tunnel", "--config", tunnelConfig, "run", "kuku-mac"],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  },
);

let stopping = false;
function stop(signal = "SIGTERM", exitCode = 0) {
  if (stopping) return;
  stopping = true;
  lanServer.kill(signal);
  tunnel.kill(signal);
  process.exit(exitCode);
}

lanServer.on("exit", (code) => stop("SIGTERM", code ?? 1));
tunnel.on("exit", (code) => stop("SIGTERM", code ?? 1));
process.on("SIGINT", () => stop("SIGINT", 0));
process.on("SIGTERM", () => stop("SIGTERM", 0));
