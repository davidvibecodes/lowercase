/**
 * lowercase answers only on its own loopback names (KTD16). Binding to
 * 127.0.0.1 alone doesn't stop DNS rebinding: a page on another hostname that
 * resolves to 127.0.0.1 would send same-origin requests with its own Host.
 */
export function loopbackHosts(port: number | string): string[] {
  return [`localhost:${port}`, `127.0.0.1:${port}`];
}

/** Exact origins for strict checks such as adminRoute (no lowercasing, Origin required). */
export function loopbackOrigins(port: number | string): string[] {
  return loopbackHosts(port).map((h) => `http://${h}`);
}

export function isAllowedHost(host: string | undefined, port: number | string): boolean {
  return !!host && loopbackHosts(port).includes(host.toLowerCase());
}

/** Browsers omit Origin on some same-origin requests; when it is present it must be ours. */
export function isAllowedOrigin(origin: string | undefined, port: number | string): boolean {
  if (!origin) return true;
  return loopbackOrigins(port).includes(origin.toLowerCase());
}
