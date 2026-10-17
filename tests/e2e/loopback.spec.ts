import { request } from "node:http";
import { expect, test } from "@playwright/test";

// server.ts can't be imported in a unit test, so its DNS-rebinding guard (KTD16) is checked against the running e2e server.
const PORT = 3100;

function get(host: string) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: PORT, path: "/login", headers: { host } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** True when the server drops a websocket upgrade without answering it. */
function upgradeDropped(host: string) {
  return new Promise<boolean>((resolve) => {
    const req = request({
      host: "127.0.0.1",
      port: PORT,
      path: "/_next/webpack-hmr",
      headers: { host, connection: "Upgrade", upgrade: "websocket", "sec-websocket-version": "13", "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==" },
    });
    req.on("upgrade", (_res, socket) => {
      socket.destroy();
      resolve(false);
    });
    req.on("response", (res) => {
      res.resume();
      resolve(false);
    });
    req.on("error", () => resolve(true));
    req.end();
  });
}

test("answers only on its own loopback names (DNS-rebinding guard, KTD16)", async () => {
  expect((await get(`localhost:${PORT}`)).status).toBe(200);
  expect((await get(`127.0.0.1:${PORT}`)).status).toBe(200);

  const foreign = await get(`evil.example:${PORT}`);
  expect(foreign.status).toBe(421);
  expect(foreign.body).toContain("Misdirected request");
  expect((await get(`localhost:${PORT + 1}`)).status).toBe(421);

  // A non-Socket.IO upgrade from a foreign Host is dropped before Next sees it.
  expect(await upgradeDropped(`evil.example:${PORT}`)).toBe(true);
});
