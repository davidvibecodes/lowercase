import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { createSessionValue } from "@/lib/auth/session-cookie";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/realtime/events";
import { attachRealtime } from "@/server/realtime";
import { clearPresence } from "@/server/realtime/presence";
import type { IO } from "@/server/realtime/types";

export type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

export type Harness = { url: string; io: IO; http: HttpServer; clients: Client[]; close: () => Promise<void> };

export async function startHarness(): Promise<Harness> {
  clearPresence();
  const http = createServer();
  const io = attachRealtime(http);
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const { port } = http.address() as AddressInfo;
  const clients: Client[] = [];
  return {
    url: `http://127.0.0.1:${port}`,
    io,
    http,
    clients,
    close: async () => {
      clients.forEach((c) => c.disconnect());
      await new Promise<void>((r) => io.close(() => r()));
    },
  };
}

/**
 * Connects as a user; resolves once the server has finished setting the
 * connection up, i.e. after its connect-time `social:changed` resync, so a
 * test's own `nextEvent` never catches that one (rejects on auth failure).
 */
export function connectAs(h: Harness, userId: string | null, before?: (c: Client) => void, extra: Record<string, string> = {}): Promise<Client> {
  const headers: Record<string, string> = { ...(userId ? { cookie: `lc_session=${encodeURIComponent(createSessionValue(userId, "dev"))}` } : {}), ...extra };
  const c: Client = connect(h.url, { transports: ["websocket"], extraHeaders: headers, reconnection: false, forceNew: true, autoConnect: false });
  h.clients.push(c);
  before?.(c);
  return new Promise((resolve, reject) => {
    c.once("social:changed", () => resolve(c));
    c.once("connect_error", (e) => reject(e));
    c.connect();
  });
}

/** Waits for the next event of a name, with a timeout. */
export function nextEvent<E extends keyof ServerToClientEvents>(c: Client, event: E, timeoutMs = 3000): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${String(event)}`)), timeoutMs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    c.once(event as any, (payload: any) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

/** Emits with an ack and resolves the ack payload. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function call<T = any>(c: Client, event: keyof ClientToServerEvents, payload: unknown): Promise<T> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c.emit as any)(event, payload, (res: T) => resolve(res));
  });
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
