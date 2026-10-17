/**
 * lowercase server (KTD1): one Node process serving Next.js and Socket.IO on
 * the same port, bound to loopback only so the passwordless test login is
 * never reachable from the network.
 */
import nextEnv from "@next/env";

const dev = process.env.NODE_ENV !== "production";
// tsx doesn't read .env; load it before any module that reads AUTH_* or DATABASE_URL.
nextEnv.loadEnvConfig(process.cwd(), dev);

const { createServer } = await import("node:http");
const { default: next } = await import("next");
const { attachRealtime } = await import("./src/server/realtime/index");
const { isAllowedHost } = await import("./src/server/loopback");
const { hostedConfigProblems, publicOrigin } = await import("./src/lib/hosting");
const { startBackups } = await import("./src/server/backup");

// Hosted mode (PUBLIC_ORIGIN set) must be fully configured before it listens on a public interface.
const problems = hostedConfigProblems();
if (problems.length) {
  console.error(["", "  lowercase can't start in hosted mode:", ...problems.map((p) => `  - ${p}`), ""].join("\n"));
  process.exit(1);
}
const origin = publicOrigin();

const port = Number(process.env.PORT ?? 3000);
// Loopback only locally, so the test login is never reachable from the network. Hosted, a proxy
// or the platform reaches the process from outside it, so it listens on every interface.
const host = process.env.HOST ?? (origin ? "0.0.0.0" : "127.0.0.1");

const app = next({ dev, hostname: "localhost", port });
await app.prepare();
const handle = app.getRequestHandler();
const upgrade = app.getUpgradeHandler();

function misdirected(res: import("node:http").ServerResponse) {
  res.statusCode = 421;
  res.setHeader("content-type", "text/plain");
  res.end("Misdirected request: open lowercase at " + (origin ?? "http://localhost:" + port));
}

const server = createServer((req, res) => {
  // Platform health check: answers before the Host guard because probes use an internal address.
  if (req.url === "/healthz") {
    res.setHeader("content-type", "text/plain");
    return res.end("ok");
  }
  // Host guard (KTD16): only our own names are served (loopback locally, the public address when hosted).
  if (!isAllowedHost(req.headers.host, port)) return misdirected(res);
  handle(req, res).catch((err) => {
    console.error(err);
    res.statusCode = 500;
    res.end("Internal error");
  });
});

attachRealtime(server);

// Next's dev HMR websocket; Socket.IO owns /socket.io upgrades.
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/socket.io")) return;
  if (!isAllowedHost(req.headers.host, port)) return socket.destroy();
  upgrade(req, socket, head);
});

server.listen(port, host, () => {
  if (origin) {
    console.log(`\n  lowercase ready (hosted, ${host}:${port})`);
    console.log(`  ➜  ${origin}\n`);
    startBackups();
    return;
  }
  console.log(`\n  lowercase ready (${dev ? "dev" : "production"})`);
  console.log(`  ➜  http://localhost:${port}`);
  console.log(`  ➜  http://127.0.0.1:${port}  (peer-tester host)\n`);
});
