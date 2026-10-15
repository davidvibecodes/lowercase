import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/lib/realtime/events";

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export const userRoom = (userId: string) => `user:${userId}`;
export const sessionRoom = (sessionId: string) => `session:${sessionId}`;

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}
