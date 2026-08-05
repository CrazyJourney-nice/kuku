#!/usr/bin/env node

import { spawn } from "node:child_process";
import { stat, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(PACKAGE_DIR, "harness", "dist");
const DEFAULT_PORT = 4173;
const HOST = "127.0.0.1";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".riv", "application/octet-stream"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

const parseArguments = () => {
  const args = process.argv.slice(2);
  let port = DEFAULT_PORT;
  let shouldOpen = false;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--open") {
      shouldOpen = true;
      continue;
    }
    if (value === "--port") {
      port = Number(args[index + 1]);
      index += 1;
      continue;
    }
    if (value?.startsWith("--port=")) {
      port = Number(value.slice("--port=".length));
    }
  }

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }

  return { port, shouldOpen };
};

const assertSupportedNode = () => {
  const major = Number(process.versions.node.split(".")[0]);
  if (!Number.isInteger(major) || major < 18) {
    throw new Error(
      `Node.js 18+ is required to run this package. Current: ${process.versions.node}`,
    );
  }
};

const resolveRequestPath = (requestUrl) => {
  const url = new URL(requestUrl ?? "/", `http://${HOST}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") {
    pathname = "/index.html";
  }

  const relativePath = pathname.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  const publicPrefix = `${path.resolve(PUBLIC_DIR)}${path.sep}`;

  if (filePath !== path.resolve(PUBLIC_DIR) && !filePath.startsWith(publicPrefix)) {
    return null;
  }
  return filePath;
};

const openBrowser = (url) => {
  const commands = {
    darwin: ["open", [url]],
    win32: ["cmd", ["/c", "start", "", url]],
  };
  const [command, args] = commands[process.platform] ?? ["xdg-open", [url]];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.on("error", () => {
    console.log(`Open this URL in a browser: ${url}`);
  });
  child.unref();
};

const main = async () => {
  assertSupportedNode();
  const { port, shouldOpen } = parseArguments();
  await stat(path.join(PUBLIC_DIR, "index.html"));

  const server = createServer(async (request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      if (!filePath) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }

      const fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) {
        throw new Error("Not a file");
      }

      const content = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": String(content.byteLength),
        "Content-Type":
          MIME_TYPES.get(path.extname(filePath).toLowerCase()) ??
          "application/octet-stream",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      if (request.method === "HEAD") {
        response.end();
      } else {
        response.end(content);
      }
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Close the other preview or run: node server.mjs --port 4174 --open`,
      );
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });

  server.listen(port, HOST, () => {
    const address = server.address();
    const activePort =
      typeof address === "object" && address ? address.port : port;
    const url = `http://${HOST}:${activePort}/`;
    console.log(`Mascot Tracking Pilot running: ${url}`);
    console.log("Press Ctrl+C to stop.");
    if (shouldOpen) {
      openBrowser(url);
    }
  });

  const stop = () => {
    server.close(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
};

main().catch((error) => {
  console.error(`Unable to start: ${error.message}`);
  process.exitCode = 1;
});
