/**
 * URL that signs a peer tester in on the *other* loopback hostname, so its
 * session cookie doesn't overwrite this tab's (cookies are scoped by host, not port; KTD4).
 */
export function peerTesterUrl(username: string, loc: Pick<Location, "protocol" | "hostname" | "port">): string {
  const otherHost = loc.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
  const port = loc.port ? `:${loc.port}` : "";
  return `${loc.protocol}//${otherHost}${port}/login/as/${encodeURIComponent(username)}`;
}
