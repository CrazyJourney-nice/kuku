import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendPort = process.env.KUKU_FRONTEND_PORT ?? "4174";

const children = [
  spawn(
    "uv",
    [
      "run",
      "--directory",
      path.join(projectRoot, "local-ai", "backend"),
      "uvicorn",
      "app.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      "8765",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  ),
  spawn(
    "npm",
    [
      "run",
      "dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      frontendPort,
      "--strictPort",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  ),
];

let stopping = false;

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  }
}

for (const child of children) {
  child.on("error", (error) => {
    console.error(`Local service failed to start: ${error.message}`);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(
        `Local service stopped unexpectedly (${signal ?? `exit ${code ?? 1}`}).`,
      );
      stop();
      process.exitCode = code ?? 1;
    }
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
