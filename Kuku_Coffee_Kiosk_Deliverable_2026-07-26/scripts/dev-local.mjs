import { fileURLToPath } from "node:url";
import path from "node:path";
import { runDevWithVision } from "./dev-with-vision.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendPort = process.env.KUKU_FRONTEND_PORT ?? "4174";

await runDevWithVision({
  projectName: "coffee kiosk",
  projectRoot,
  visionBackendDirectory: path.join(
    projectRoot,
    "local-ai",
    "backend",
  ),
  frontendCommand: {
    command: "npm",
    args: [
      "run",
      "dev:frontend",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      frontendPort,
      "--strictPort",
    ],
  },
});
