import { spawn } from "node:child_process";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const VISION_HOST = "127.0.0.1";
const VISION_PORT = 8765;
const VISION_ORIGIN = `http://${VISION_HOST}:${VISION_PORT}`;
const COORDINATION_DIRECTORY = path.join(
  os.tmpdir(),
  "kuku-local-vision-8765",
);
const LOCK_DIRECTORY = path.join(COORDINATION_DIRECTORY, "startup.lock");
const LEASE_DIRECTORY = path.join(COORDINATION_DIRECTORY, "leases");
const SERVICE_FILE = path.join(COORDINATION_DIRECTORY, "service.json");
const CURRENT_LEASE = path.join(
  LEASE_DIRECTORY,
  `${process.pid}-${Date.now()}.json`,
);

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function visionIsRunning() {
  try {
    const response = await fetch(`${VISION_ORIGIN}/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return false;
    const health = await response.json();
    return health?.local_only === true && health?.mode === "LIVE";
  } catch {
    return false;
  }
}

async function acquireLock() {
  await mkdir(COORDINATION_DIRECTORY, { recursive: true });

  for (let attempt = 0; attempt < 240; attempt += 1) {
    try {
      await mkdir(LOCK_DIRECTORY);
      await writeFile(
        path.join(LOCK_DIRECTORY, "owner.json"),
        JSON.stringify({ pid: process.pid, createdAt: Date.now() }),
      );
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    const owner = await readJson(path.join(LOCK_DIRECTORY, "owner.json"));
    let stale = owner && !processIsRunning(owner.pid);
    if (!owner) {
      try {
        stale =
          Date.now() - (await stat(LOCK_DIRECTORY)).mtimeMs > 5_000;
      } catch {
        stale = false;
      }
    }
    if (stale) {
      const staleLock = `${LOCK_DIRECTORY}.stale-${process.pid}-${Date.now()}`;
      try {
        await rename(LOCK_DIRECTORY, staleLock);
        await rm(staleLock, { recursive: true, force: true });
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      continue;
    }
    await delay(250);
  }

  throw new Error("Timed out waiting for the shared vision startup lock.");
}

async function releaseLock() {
  const owner = await readJson(path.join(LOCK_DIRECTORY, "owner.json"));
  if (owner?.pid === process.pid) {
    await rm(LOCK_DIRECTORY, { recursive: true, force: true });
  }
}

async function removeStaleLeases() {
  await mkdir(LEASE_DIRECTORY, { recursive: true });
  const leases = await readdir(LEASE_DIRECTORY);
  await Promise.all(
    leases.map(async (leaseName) => {
      const leasePath = path.join(LEASE_DIRECTORY, leaseName);
      const lease = await readJson(leasePath);
      if (!lease || !processIsRunning(lease.pid)) {
        await rm(leasePath, { force: true });
      }
    }),
  );
}

async function createLease(projectName) {
  await mkdir(LEASE_DIRECTORY, { recursive: true });
  const handle = await open(CURRENT_LEASE, "wx");
  await handle.writeFile(
    JSON.stringify({ pid: process.pid, projectName, createdAt: Date.now() }),
  );
  await handle.close();
}

function terminateProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process already stopped.
    }
  }
}

async function waitForVision(
  visionProcess,
  getSpawnError,
  timeoutMs = 45_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await visionIsRunning()) return;
    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error(`Vision process failed to start: ${spawnError.message}`);
    }
    if (
      visionProcess.exitCode !== null ||
      visionProcess.signalCode !== null
    ) {
      throw new Error(
        `Vision process stopped before becoming ready (exit ${
          visionProcess.exitCode ?? visionProcess.signalCode
        }).`,
      );
    }
    await delay(250);
  }
  throw new Error(`Vision system did not become ready at ${VISION_ORIGIN}.`);
}

async function ensureVision({
  projectName,
  projectRoot,
  visionBackendDirectory,
}) {
  await acquireLock();
  try {
    await removeStaleLeases();
    const service = await readJson(SERVICE_FILE);

    if (await visionIsRunning()) {
      if (service && processIsRunning(service.pid)) {
        await createLease(projectName);
      }
      console.log(
        `[vision] Already running at ${VISION_ORIGIN}; startup skipped.`,
      );
      return;
    }

    if (service && !processIsRunning(service.pid)) {
      await rm(SERVICE_FILE, { force: true });
    }

    console.log(`[vision] Starting shared visual system at ${VISION_ORIGIN}…`);
    await mkdir(path.join(COORDINATION_DIRECTORY, "matplotlib"), {
      recursive: true,
    });
    const visionProcess = spawn(
      "uv",
      [
        "run",
        "--directory",
        visionBackendDirectory,
        "uvicorn",
        "app.main:app",
        "--host",
        VISION_HOST,
        "--port",
        String(VISION_PORT),
      ],
      {
        cwd: projectRoot,
        detached: true,
        env: {
          ...process.env,
          OPENVINO_TELEMETRY_OPT_OUT: "1",
          HF_HUB_OFFLINE: "1",
          TRANSFORMERS_OFFLINE: "1",
          VENDING_ATTENTION_OFFLINE_GUARD: "1",
          VENDING_ATTENTION_ROOT: path.dirname(visionBackendDirectory),
          MPLCONFIGDIR: path.join(
            COORDINATION_DIRECTORY,
            "matplotlib",
          ),
        },
        stdio: "inherit",
      },
    );
    let spawnError = null;
    visionProcess.on("error", (error) => {
      spawnError = error;
    });

    try {
      await waitForVision(visionProcess, () => spawnError);
      await writeFile(
        SERVICE_FILE,
        JSON.stringify({
          pid: visionProcess.pid,
          origin: VISION_ORIGIN,
          startedAt: Date.now(),
          startedFrom: projectRoot,
        }),
      );
      await createLease(projectName);
      visionProcess.unref();
      console.log("[vision] Ready.");
    } catch (error) {
      if (visionProcess.pid) {
        terminateProcessGroup(visionProcess.pid, "SIGTERM");
      }
      throw error;
    }
  } finally {
    await releaseLock();
  }
}

async function stopManagedVisionIfUnused() {
  await acquireLock();
  try {
    await rm(CURRENT_LEASE, { force: true });
    await removeStaleLeases();
    if ((await readdir(LEASE_DIRECTORY)).length > 0) return;

    const service = await readJson(SERVICE_FILE);
    if (!service || !processIsRunning(service.pid)) {
      await rm(SERVICE_FILE, { force: true });
      return;
    }

    console.log("[vision] No dev servers remain; stopping visual system.");
    terminateProcessGroup(service.pid, "SIGTERM");

    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && (await visionIsRunning())) {
      await delay(100);
    }
    if (await visionIsRunning()) {
      terminateProcessGroup(service.pid, "SIGKILL");
    }
    await rm(SERVICE_FILE, { force: true });
  } finally {
    await releaseLock();
  }
}

export async function runDevWithVision({
  projectName,
  projectRoot,
  visionBackendDirectory,
  frontendCommand,
}) {
  await ensureVision({
    projectName,
    projectRoot,
    visionBackendDirectory,
  });

  const frontend = spawn(frontendCommand.command, frontendCommand.args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  let stopping = false;
  const stop = async (signal = "SIGTERM", exitCode = 0) => {
    if (stopping) return;
    stopping = true;
    if (frontend.exitCode === null && frontend.signalCode === null) {
      frontend.kill(signal);
    }
    await stopManagedVisionIfUnused();
    process.exit(exitCode);
  };

  frontend.on("error", (error) => {
    console.error(`[dev] Frontend failed to start: ${error.message}`);
    void stop("SIGTERM", 1);
  });
  frontend.on("exit", (code, signal) => {
    if (stopping) return;
    const failed = code !== 0 && signal == null;
    void stop("SIGTERM", failed ? code ?? 1 : 0);
  });

  process.on("SIGINT", () => void stop("SIGINT", 130));
  process.on("SIGTERM", () => void stop("SIGTERM", 143));
}
