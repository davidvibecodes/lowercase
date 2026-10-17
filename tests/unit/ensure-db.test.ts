import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const prismaCli = resolve(root, "node_modules/prisma/build/index.js");
const INIT = "20261015084915_init";

// ensure-db resolves DATABASE_URL relative to prisma/, so the database lives there; the init-only schema copy doesn't.
const file = "ensure-backup-test.db";
const dbPath = resolve(root, "prisma", file);
const schemaDir = mkdtempSync(join(tmpdir(), "lc-ensure-db-"));
const created: string[] = [];
const clean = () => ["", "-journal", "-wal", "-shm"].forEach((s) => rmSync(dbPath + s, { force: true }));

afterAll(() => {
  clean();
  for (const f of created) rmSync(f, { force: true });
  rmSync(schemaDir, { recursive: true, force: true });
});

/** A database at the init migration with one user: what the owner's dev.db looked like before this change. */
function populatedInitDb() {
  clean();
  cpSync(resolve(root, "prisma/schema.prisma"), join(schemaDir, "schema.prisma"));
  cpSync(resolve(root, "prisma/migrations/migration_lock.toml"), join(schemaDir, "migrations/migration_lock.toml"));
  cpSync(resolve(root, `prisma/migrations/${INIT}`), join(schemaDir, `migrations/${INIT}`), { recursive: true });
  const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(schemaDir, "schema.prisma")], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}` },
    stdio: "pipe",
  });
  if (r.status !== 0) throw new Error(`migrate deploy failed: ${r.stderr?.toString()}`);
  const sql = new DatabaseSync(dbPath);
  sql.exec(`INSERT INTO "User" (id, username, firstName, lastName, email, isAdmin) VALUES ('u1','owner','David','S','owner@example.com',1)`);
  sql.close();
}

describe("ensure-db backup before migrating (KTD15)", () => {
  it("writes a consistent pre-migration copy, then migrates and keeps the data", () => {
    populatedInitDb();
    const run = spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), "scripts/ensure-db.ts"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: `file:./${file}` },
      stdio: "pipe",
    });
    const out = run.stdout.toString() + run.stderr.toString();
    expect(run.status, out).toBe(0);

    const backup = /backed up the database to (.+?) before migrating/.exec(out)?.[1];
    expect(backup, out).toBeTruthy();
    created.push(backup!);
    expect(existsSync(backup!)).toBe(true);

    // The backup is the database as it was: one user, only the init migration applied.
    const copy = new DatabaseSync(backup!, { readOnly: true });
    try {
      expect(copy.prepare(`SELECT email FROM "User"`).all()).toEqual([{ email: "owner@example.com" }]);
      expect(copy.prepare(`SELECT migration_name FROM _prisma_migrations`).all()).toEqual([{ migration_name: INIT }]);
    } finally {
      copy.close();
    }

    // The live file was migrated, kept its user and wasn't reseeded.
    const live = new DatabaseSync(dbPath, { readOnly: true });
    try {
      expect(live.prepare(`SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`).get()).toEqual({ n: 2 });
      expect(live.prepare(`SELECT id, username FROM "User"`).all()).toEqual([{ id: "u1", username: "owner" }]);
    } finally {
      live.close();
    }
  }, 120_000);

  it("skips the backup on an up-to-date database", () => {
    // Runs after the test above, so every migration is applied by now.
    const run = spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), "scripts/ensure-db.ts"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: `file:./${file}` },
      stdio: "pipe",
    });
    const out = run.stdout.toString() + run.stderr.toString();
    expect(run.status, out).toBe(0);
    expect(out).not.toContain("backed up the database");
  }, 120_000);
});
