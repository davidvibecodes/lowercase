/** Node references stored as a JSON array of stable tree keys (KTD11). */
export function keysFromJson(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function keysToJson(keys: string[] | null | undefined): string | null {
  return keys?.length ? JSON.stringify(keys) : null;
}

/** Every tree key an item points at: its own node plus any prerequisites. */
export function itemNodeKeys(nodeKey: string | null | undefined, prerequisites: string[]): string[] {
  return [...(nodeKey ? [nodeKey] : []), ...prerequisites];
}
