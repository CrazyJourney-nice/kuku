#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFile, stat } from "node:fs/promises";
import { createServer as createPortProbe } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_RIV_SHA256 =
  "b8ceb9406be38bc780af6fb49dbde9009c8a3009ffbd683b0564836fb2cd12a9";

const requiredFiles = [
  "README-FIRST.md",
  "server.mjs",
  "harness/dist/index.html",
  "harness/dist/mascot-tracking-pilot-v1.riv",
  "harness/package.json",
  "harness/package-lock.json",
  "rive/mascot-tracking-pilot-v1.riv",
  "rive/mascot-tracking-pilot-v1-integration-contract.md",
  "qa/rive/rive-import-validation-report.md",
  "qa/rive/rive-runtime-validation-report.md",
  "qa/rive/pose-neutral.png",
  "source-assets/mascot-interactive-topology-v1-master.ai",
  "source-assets/mascot-interactive-topology-v1-runtime.svg",
];

const sha256 = (content) =>
  createHash("sha256").update(content).digest("hex");

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const getFreePort = async () => {
  const probe = createPortProbe();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => probe.close(resolve));
  return port;
};

const waitForServer = async (url) => {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Local server did not start: ${lastError?.message ?? "timeout"}`);
};

const verifyChecksums = async () => {
  const manifestPath = path.join(PACKAGE_DIR, "SHA256SUMS.txt");
  try {
    const manifest = await readFile(manifestPath, "utf8");
    const lines = manifest.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const match = line.match(/^([a-f0-9]{64})  (.+)$/);
      assert(match, `Invalid checksum line: ${line}`);
      const [, expected, relativePath] = match;
      const content = await readFile(path.join(PACKAGE_DIR, relativePath));
      assert(
        sha256(content) === expected,
        `Checksum mismatch: ${relativePath}`,
      );
    }
    return lines.length;
  } catch (error) {
    if (error.code === "ENOENT") {
      return 0;
    }
    throw error;
  }
};

const main = async () => {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  assert(nodeMajor >= 18, `Node.js 18+ required; found ${process.versions.node}`);

  for (const relativePath of requiredFiles) {
    const fileInfo = await stat(path.join(PACKAGE_DIR, relativePath));
    assert(fileInfo.isFile(), `Missing required file: ${relativePath}`);
  }

  const canonicalRiv = await readFile(
    path.join(PACKAGE_DIR, "rive", "mascot-tracking-pilot-v1.riv"),
  );
  const servedRiv = await readFile(
    path.join(
      PACKAGE_DIR,
      "harness",
      "dist",
      "mascot-tracking-pilot-v1.riv",
    ),
  );
  assert(
    sha256(canonicalRiv) === EXPECTED_RIV_SHA256,
    "Canonical .riv SHA-256 does not match the validated runtime",
  );
  assert(
    sha256(servedRiv) === EXPECTED_RIV_SHA256,
    "Served .riv differs from the validated runtime",
  );

  const indexHtml = await readFile(
    path.join(PACKAGE_DIR, "harness", "dist", "index.html"),
    "utf8",
  );
  const jsMatch = indexHtml.match(/\.\/assets\/([^"]+\.js)/);
  const cssMatch = indexHtml.match(/\.\/assets\/([^"]+\.css)/);
  assert(jsMatch?.[1], "Built JavaScript asset is not referenced by index.html");
  assert(cssMatch?.[1], "Built CSS asset is not referenced by index.html");

  const jsPath = path.join(
    PACKAGE_DIR,
    "harness",
    "dist",
    "assets",
    jsMatch[1],
  );
  const jsBundle = await readFile(jsPath, "utf8");
  const wasmMatch = jsBundle.match(
    /new URL\([`'"](rive-[A-Za-z0-9_-]+\.wasm)[`'"],import\.meta\.url\)/,
  );
  assert(wasmMatch?.[1], "Built runtime does not reference a local Rive WASM");
  assert(
    jsBundle.includes("setWasmFallbackUrl(null)"),
    "CDN fallback is not disabled",
  );
  await stat(
    path.join(PACKAGE_DIR, "harness", "dist", "assets", wasmMatch[1]),
  );

  const checksumCount = await verifyChecksums();
  const port = await getFreePort();
  const server = spawn(
    process.execPath,
    [path.join(PACKAGE_DIR, "server.mjs"), "--port", String(port)],
    {
      cwd: PACKAGE_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let serverError = "";
  server.stderr.on("data", (chunk) => {
    serverError += chunk.toString();
  });

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    const indexResponse = await waitForServer(`${baseUrl}/`);
    const html = await indexResponse.text();
    assert(html.includes("Mascot Tracking Pilot"), "Unexpected index.html");

    const rivResponse = await fetch(
      `${baseUrl}/mascot-tracking-pilot-v1.riv`,
    );
    assert(rivResponse.ok, "HTTP server did not serve the .riv");
    assert(
      sha256(Buffer.from(await rivResponse.arrayBuffer())) ===
        EXPECTED_RIV_SHA256,
      "HTTP-served .riv checksum mismatch",
    );

    const wasmResponse = await fetch(
      `${baseUrl}/assets/${wasmMatch[1]}`,
    );
    assert(wasmResponse.ok, "HTTP server did not serve local Rive WASM");
    assert(
      wasmResponse.headers.get("content-type") === "application/wasm",
      "Rive WASM has the wrong MIME type",
    );
  } finally {
    server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }

  assert(!serverError, `Local server error: ${serverError.trim()}`);
  console.log("PASS: portable Mascot Rive package verified");
  console.log(`PASS: canonical and served .riv SHA-256 ${EXPECTED_RIV_SHA256}`);
  console.log("PASS: local Rive WASM is bundled and served as application/wasm");
  console.log(`PASS: HTTP smoke test completed on 127.0.0.1:${port}`);
  if (checksumCount > 0) {
    console.log(`PASS: ${checksumCount} packaged-file checksums verified`);
  }
};

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
