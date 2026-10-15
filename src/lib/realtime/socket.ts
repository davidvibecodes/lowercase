"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ClientSocket | null = null;

/** One socket per tab; it authenticates with the httpOnly session cookie. */
export function getSocket(): ClientSocket {
  if (!socket) {
    socket = io({
      transports: ["websocket"],
      withCredentials: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

const ACK_TIMEOUT_MS = 8000;

/**
 * Emits with an acknowledgement and resolves its payload. A lost connection
 * resolves as a failure after a timeout, so callers' busy states always clear.
 */
export function emitAck<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<Parameters<Parameters<ClientToServerEvents[E]>[1]>[0]> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getSocket().timeout(ACK_TIMEOUT_MS).emit as any)(event, payload, (err: unknown, res: any) =>
      resolve(err ? { ok: false, error: "Connection lost. Try again." } : res),
    );
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
