import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

/** Fresh migrated test.db for the unit/service suites. */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(resolve(root, `prisma/test.db${suffix}`), { force: true });
  const r = spawnSync(process.execPath, [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
  if (r.status !== 0) throw new Error(`migrate deploy failed: ${r.stderr?.toString()}`);
}
