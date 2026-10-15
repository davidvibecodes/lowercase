/**
 * Starts an isolated server for Playwright: a freshly reseeded e2e.db on its
 * own port, so tests never touch dev.db and always begin from seed state.
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

const tsxCli = resolve(root, "node_modules/tsx/dist/cli.mjs");
const r = spawnSync(process.execPath, [tsxCli, "scripts/ensure-db.ts"], { cwd: root, stdio: "inherit", env: process.env });
if (r.status !== 0) process.exit(r.status ?? 1);

await import("../server");
