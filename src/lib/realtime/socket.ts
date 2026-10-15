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

/** Emits with an acknowledgement and resolves its payload. */
export function emitAck<E extends keyof ClientToServerEvents>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<Parameters<Parameters<ClientToServerEvents[E]>[1]>[0]> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (getSocket().emit as any)(event, payload, resolve);
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
