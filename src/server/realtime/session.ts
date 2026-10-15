import type { IO, IOSocket } from "./types";

/** Live session handlers arrive with the session lobby (U10). */
export function registerSessionHandlers(_io: IO, _socket: IOSocket) {}

export async function onUserDisconnected(_io: IO, _userId: string) {}
