/**
 * In-memory presence: userId → open socket ids (KTD2). Lives on globalThis so
 * Next server components in the same process can read it for first paint.
 */
type Registry = Map<string, Set<string>>;

const g = globalThis as unknown as { __lowercasePresence?: Registry };
const registry: Registry = (g.__lowercasePresence ??= new Map());

/** Returns true when this socket made the user go online. */
export function addSocket(userId: string, socketId: string): boolean {
  const set = registry.get(userId) ?? new Set<string>();
  const wasOffline = set.size === 0;
  set.add(socketId);
  registry.set(userId, set);
  return wasOffline;
}

/** Returns true when this socket was the user's last one. */
export function removeSocket(userId: string, socketId: string): boolean {
  const set = registry.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    registry.delete(userId);
    return true;
  }
  return false;
}

export function isOnline(userId: string): boolean {
  return (registry.get(userId)?.size ?? 0) > 0;
}

export function onlineUserIds(): string[] {
  return [...registry.keys()];
}

/** Test helper. */
export function clearPresence() {
  registry.clear();
}
