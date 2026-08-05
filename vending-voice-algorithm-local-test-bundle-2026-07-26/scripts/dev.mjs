import { fileURLToPath } from "node:url";
import path from "node:path";
import { runDevWithVision } from "./dev-with-vision.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

await runDevWithVision({
  projectName: "visual/voice demo",
  projectRoot,
  visionBackendDirectory: path.join(projectRoot, "backend"),
  frontendCommand: {
    command: "npm",
    args: ["--prefix", "frontend", "run", "dev"],
  },
});
