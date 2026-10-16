import type { IO } from "./types";

/**
 * The live Socket.IO server, shared on globalThis so server actions (bundled
 * by Next) can reach the instance server.ts created (tsx) — the same pattern
 * presence uses (KTD9). Null in processes without a socket server.
 */
const g = globalThis as unknown as { __lowercaseIo?: IO | null };

export function setIo(io: IO | null) {
  g.__lowercaseIo = io;
}

export function getIo(): IO | null {
  return g.__lowercaseIo ?? null;
}
