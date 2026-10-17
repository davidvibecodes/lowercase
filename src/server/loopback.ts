/**
 * lowercase answers only on its own names (KTD16). Locally those are the two
 * loopback names: binding to 127.0.0.1 alone doesn't stop DNS rebinding, since
 * a page on another hostname that resolves to 127.0.0.1 would send same-origin
 * requests with its own Host. When hosted (PUBLIC_ORIGIN set) the only name is
 * the public address, which also keeps a stray hostname from reaching the app.
 */
import { publicOrigin } from "@/lib/hosting";

export function loopbackHosts(port: number | string): string[] {
  return [`localhost:${port}`, `127.0.0.1:${port}`];
}

/** Exact origins for strict checks such as adminRoute (no lowercasing, Origin required). */
export function loopbackOrigins(port: number | string): string[] {
  return loopbackHosts(port).map((h) => `http://${h}`);
}

/** Every Host value this process serves. */
export function allowedHosts(port: number | string): string[] {
  const origin = publicOrigin();
  return origin ? [new URL(origin).host] : loopbackHosts(port);
}

/** Every Origin value this process accepts. */
export function allowedOrigins(port: number | string): string[] {
  const origin = publicOrigin();
  return origin ? [origin] : loopbackOrigins(port);
}

export function isAllowedHost(host: string | undefined, port: number | string): boolean {
  return !!host && allowedHosts(port).includes(host.toLowerCase());
}

/** Browsers omit Origin on some same-origin requests; when it is present it must be ours. */
export function isAllowedOrigin(origin: string | undefined, port: number | string): boolean {
  if (!origin) return true;
  return allowedOrigins(port).includes(origin.toLowerCase());
}
