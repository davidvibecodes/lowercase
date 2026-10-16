/**
 * Starts an isolated server for Playwright: a freshly reseeded e2e.db on its
 * own port and a fake Google IdP, so tests never touch dev.db or real Google
 * and always begin from seed state.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(resolve(root, `prisma/e2e.db${s}`), { force: true });

process.env.DATABASE_URL = "file:./e2e.db";
process.env.PORT ??= "3100";
process.env.AUTH_MODE = "dev";
process.env.INVITE_TTL_MS ??= "120000";

// "Continue with Google" against the shared fake IdP (KTD3); specs pick the persona via POST /__persona.
const { startFakeGoogle } = await import("../tests/helpers/fake-google");
const fake = await startFakeGoogle({ port: Number(process.env.FAKE_GOOGLE_PORT ?? 3199) });
Object.assign(process.env, {
  LC_FAKE_GOOGLE: "1",
  GOOGLE_OIDC_BASE_URL: fake.baseUrl,
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  GOOGLE_REDIRECT_URI: `http://localhost:${process.env.PORT}/login/google/callback`,
});

const tsxCli = resolve(root, "node_modules/tsx/dist/cli.mjs");
const r = spawnSync(process.execPath, [tsxCli, "scripts/ensure-db.ts"], { cwd: root, stdio: "inherit", env: process.env });
if (r.status !== 0) process.exit(r.status ?? 1);

await import("../server");
