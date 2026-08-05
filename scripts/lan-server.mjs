import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const VISION_ROOT = path.join(
  PROJECT_ROOT,
  "vending-voice-algorithm-local-test-bundle-2026-07-26",
);
const VISION_BACKEND = path.join(VISION_ROOT, "backend");

const PUBLIC_HOST = process.env.KUKU_LAN_HOST ?? "0.0.0.0";
const PUBLIC_PORT = readPort(process.env.KUKU_LAN_PORT ?? "4173", "KUKU_LAN_PORT");
const VISUAL_PUBLIC_HOSTNAME =
  process.env.KUKU_VISUAL_HOSTNAME ?? "visual.rejoices.dev";
const FRONTEND_HOST = "127.0.0.1";
const VISION_HOST = "127.0.0.1";
const VISION_PORT = 8765;

let frontendProcess = null;
let visionProcess = null;
let gateway = null;
let stopping = false;

function readPort(raw, label) {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer between 1 and 65535.`);
  }
  return port;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function freeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, FRONTEND_HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

function childStopped(child) {
  return child && (child.exitCode !== null || child.signalCode !== null);
}

async function readHealth() {
  try {
    const response = await fetch(`http://${VISION_HOST}:${VISION_PORT}/health`, {
      signal: AbortSignal.timeout(800),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function waitFor(label, url, child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childStopped(child)) {
      throw new Error(`${label} stopped before becoming ready.`);
    }
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // The service is still starting.
    }
    await delay(250);
  }
  throw new Error(`${label} did not become ready within ${timeoutMs / 1000}s.`);
}

function startVision() {
  const matplotlibDirectory = path.join(
    os.tmpdir(),
    "kuku-lan-server-matplotlib",
  );
  return spawn(
    "uv",
    [
      "run",
      "--directory",
      VISION_BACKEND,
      "uvicorn",
      "app.main:app",
      "--host",
      VISION_HOST,
      "--port",
      String(VISION_PORT),
    ],
    {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        OPENVINO_TELEMETRY_OPT_OUT: "1",
        HF_HUB_OFFLINE: "1",
        TRANSFORMERS_OFFLINE: "1",
        VENDING_ATTENTION_OFFLINE_GUARD: "1",
        VENDING_ATTENTION_ROOT: VISION_ROOT,
        MPLCONFIGDIR: matplotlibDirectory,
      },
      stdio: "inherit",
    },
  );
}

function startFrontend(port) {
  return spawn(
    "npm",
    [
      "run",
      "dev:frontend",
      "--",
      "--host",
      FRONTEND_HOST,
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: "inherit",
    },
  );
}

function isVisionPath(requestPath = "/") {
  const pathname = new URL(requestPath, "http://kuku.local").pathname;
  return (
    pathname === "/health" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/ws/")
  );
}

function isVisualHostname(host = "") {
  const hostname = host.trim().toLowerCase().split(":")[0];
  return hostname === VISUAL_PUBLIC_HOSTNAME.toLowerCase();
}

function proxyHeaders(request, targetPort, backend) {
  const headers = {
    ...request.headers,
    host: `127.0.0.1:${targetPort}`,
    "x-forwarded-host": request.headers.host ?? "",
    "x-forwarded-proto": "http",
  };
  if (backend && request.headers.origin) {
    headers.origin = `http://${VISION_HOST}:${VISION_PORT}`;
  }
  return headers;
}

function writeUpgradeResponse(clientSocket, response) {
  const statusMessage = response.statusMessage
    ? ` ${response.statusMessage}`
    : "";
  clientSocket.write(
    `HTTP/1.1 ${response.statusCode ?? 101}${statusMessage}\r\n`,
  );
  for (const [name, value] of Object.entries(response.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) clientSocket.write(`${name}: ${item}\r\n`);
    } else if (value !== undefined) {
      clientSocket.write(`${name}: ${value}\r\n`);
    }
  }
  clientSocket.write("\r\n");
}

function createGateway(frontendPort) {
  const server = http.createServer((request, response) => {
    const backend =
      isVisualHostname(request.headers.host) || isVisionPath(request.url);
    const targetPort = backend ? VISION_PORT : frontendPort;
    const proxy = http.request(
      {
        hostname: "127.0.0.1",
        port: targetPort,
        method: request.method,
        path: request.url,
        headers: proxyHeaders(request, targetPort, backend),
      },
      (upstream) => {
        response.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(response);
      },
    );
    proxy.on("error", (error) => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Kuku upstream unavailable: ${error.message}`);
    });
    request.pipe(proxy);
  });

  server.on("upgrade", (request, clientSocket, head) => {
    // Browsers and health probes may close long-lived telemetry sockets at any
    // point. Treat that as a normal disconnect instead of crashing the server.
    clientSocket.on("error", () => {
      // The paired upstream socket is closed by the pipe/error handlers below.
    });
    if (!isVisionPath(request.url) || !request.url?.startsWith("/ws/")) {
      clientSocket.destroy();
      return;
    }
    const proxy = http.request({
      hostname: VISION_HOST,
      port: VISION_PORT,
      method: request.method,
      path: request.url,
      headers: proxyHeaders(request, VISION_PORT, true),
    });
    proxy.on("upgrade", (upstream, upstreamSocket, upstreamHead) => {
      upstreamSocket.on("error", () => clientSocket.destroy());
      clientSocket.on("error", () => upstreamSocket.destroy());
      upstreamSocket.on("close", () => clientSocket.destroy());
      clientSocket.on("close", () => upstreamSocket.destroy());
      writeUpgradeResponse(clientSocket, upstream);
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) clientSocket.write(upstreamHead);
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    });
    proxy.on("response", (upstream) => {
      if (!clientSocket.destroyed) {
        writeUpgradeResponse(clientSocket, upstream);
        upstream.pipe(clientSocket);
      }
    });
    proxy.on("error", () => clientSocket.destroy());
    proxy.end();
  });

  return server;
}

function lanAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const address of interfaces ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return [...new Set(addresses)];
}

async function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PUBLIC_PORT, PUBLIC_HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (gateway) {
    await new Promise((resolve) => gateway.close(resolve));
  }
  frontendProcess?.kill("SIGTERM");
  visionProcess?.kill("SIGTERM");
  process.exit(exitCode);
}

try {
  const currentHealth = await readHealth();
  if (currentHealth) {
    if (currentHealth.local_only !== true || currentHealth.mode !== "LIVE") {
      throw new Error(
        `Port ${VISION_PORT} is occupied by an incompatible service.`,
      );
    }
    console.log(`[vision] Reusing ${VISION_HOST}:${VISION_PORT}.`);
  } else {
    console.log("[vision] Starting the local camera and voice runtime…");
    visionProcess = startVision();
    await waitFor(
      "Local vision runtime",
      `http://${VISION_HOST}:${VISION_PORT}/health`,
      visionProcess,
    );
  }

  const frontendPort = await freeLoopbackPort();
  frontendProcess = startFrontend(frontendPort);
  await waitFor(
    "Kuku frontend",
    `http://${FRONTEND_HOST}:${frontendPort}/`,
    frontendProcess,
  );

  gateway = createGateway(frontendPort);
  await listen(gateway);

  const addresses = lanAddresses();
  console.log("\nKuku LAN server is ready.");
  console.log(`This Mac: http://127.0.0.1:${PUBLIC_PORT}`);
  for (const address of addresses) {
    console.log(`Other devices: http://${address}:${PUBLIC_PORT}`);
  }
  console.log("Keep this terminal running while the other computer is using Kuku.\n");

  frontendProcess.on("exit", () => void stop(1));
  visionProcess?.on("exit", () => void stop(1));
  process.on("SIGINT", () => void stop(0));
  process.on("SIGTERM", () => void stop(0));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await stop(1);
}
