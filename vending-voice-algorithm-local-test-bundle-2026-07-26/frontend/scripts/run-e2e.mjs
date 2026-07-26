import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const requestedPort = process.env.E2E_PORT;

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`E2E_PORT must be an integer between 1 and 65535; received ${value}.`);
  }
  return port;
}

function inspectPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (
        error.code === "EADDRINUSE"
        || error.code === "EACCES"
        || error.code === "EPERM"
      ) {
        resolve(null);
        return;
      }
      reject(error);
    });
    server.listen({ host: HOST, port }, () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(typeof address === "object" && address ? address.port : null);
      });
    });
  });
}

async function choosePort() {
  if (requestedPort) {
    const port = parsePort(requestedPort);
    if ((await inspectPort(port)) === null) {
      throw new Error(
        `E2E_PORT ${port} is already occupied or unavailable. Stop that service or choose another port.`,
      );
    }
    return port;
  }

  const port = await inspectPort(0);
  if (port === null) {
    throw new Error("The operating system could not allocate a free local E2E port.");
  }
  return port;
}

const port = await choosePort();
const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);

console.log(`E2E preview will use free local port ${port}.`);

const child = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  env: { ...process.env, PLAYWRIGHT_E2E_PORT: String(port) },
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
