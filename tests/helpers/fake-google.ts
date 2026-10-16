/**
 * A local stand-in for Google's OAuth endpoints (KTD3), shared by Vitest and
 * Playwright. It checks PKCE, echoes the nonce and issues an RS256-shaped
 * id_token whose claims each test chooses. The signature is junk on purpose:
 * tokens from the token endpoint aren't signature-checked.
 */
import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type Persona = {
  sub: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  /** Simulate the user cancelling on Google's consent screen. */
  deny?: boolean;
};

type Grant = { persona: Persona; nonce: string; challenge: string; redirectUri: string; clientId: string };

export type FakeGoogle = {
  baseUrl: string;
  setNextPersona: (p: Persona) => void;
  /** The code_verifier values the token endpoint received, newest last. */
  verifiers: string[];
  close: () => Promise<void>;
};

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

function readBody(req: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(new URLSearchParams(data)));
  });
}

export async function startFakeGoogle(opts: { port?: number; clientId?: string; clientSecret?: string } = {}): Promise<FakeGoogle> {
  const clientId = opts.clientId ?? "test-client-id";
  const clientSecret = opts.clientSecret ?? "test-client-secret";
  const grants = new Map<string, Grant>();
  const verifiers: string[] = [];
  let next: Persona = { sub: "fake-sub-1", email: "someone@gmail.com", name: "Some One" };
  let baseUrl = "";

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", baseUrl);
    if (req.method === "GET" && url.pathname === "/authorize") {
      const redirectUri = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";
      const back = new URL(redirectUri);
      if (next.deny) {
        back.searchParams.set("error", "access_denied");
        back.searchParams.set("state", state);
      } else {
        const code = randomBytes(12).toString("hex");
        grants.set(code, {
          persona: next,
          nonce: url.searchParams.get("nonce") ?? "",
          challenge: url.searchParams.get("code_challenge") ?? "",
          redirectUri,
          clientId: url.searchParams.get("client_id") ?? "",
        });
        back.searchParams.set("code", code);
        back.searchParams.set("state", state);
      }
      res.writeHead(302, { location: back.toString() }).end();
      return;
    }
    if (req.method === "POST" && url.pathname === "/token") {
      const body = await readBody(req);
      const grant = grants.get(body.get("code") ?? "");
      const verifier = body.get("code_verifier") ?? "";
      verifiers.push(verifier);
      const pkceOk = grant && createHash("sha256").update(verifier).digest("base64url") === grant.challenge;
      const clientOk = body.get("client_id") === clientId && body.get("client_secret") === clientSecret;
      if (!grant || !pkceOk || !clientOk || body.get("redirect_uri") !== grant.redirectUri || body.get("grant_type") !== "authorization_code") {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }
      grants.delete(body.get("code") ?? "");
      const now = Math.floor(Date.now() / 1000);
      const p = grant.persona;
      const claims = {
        iss: baseUrl,
        aud: clientId,
        sub: p.sub,
        email: p.email,
        email_verified: p.emailVerified ?? true,
        name: p.name,
        given_name: p.givenName,
        family_name: p.familyName,
        picture: p.picture,
        nonce: grant.nonce,
        iat: now,
        exp: now + 3600,
      };
      const idToken = `${b64({ alg: "RS256", typ: "JWT", kid: "fake" })}.${b64(claims)}.${b64("not-a-real-signature")}`;
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ access_token: "fake-access-token", token_type: "Bearer", expires_in: 3600, id_token: idToken }));
      return;
    }
    if (req.method === "POST" && url.pathname === "/__persona") {
      const body = await readBody(req);
      next = JSON.parse(body.get("persona") ?? "{}");
      res.writeHead(204).end();
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise<void>((r) => server.listen(opts.port ?? 0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    baseUrl,
    setNextPersona: (p) => {
      next = p;
    },
    verifiers,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
