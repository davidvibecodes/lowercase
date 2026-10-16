/**
 * Bootstraps a local database (KTD12): writes .env if missing, generates the
 * Prisma client when the schema changed, applies migrations, enables WAL and
 * seeds an empty database. Safe to run repeatedly.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import nextEnv from "@next/env";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");

if (!existsSync(envPath)) {
  writeFileSync(
    envPath,
    [
      `DATABASE_URL="file:./dev.db"`,
      `AUTH_SECRET="${randomBytes(32).toString("hex")}"`,
      `# Enables the passwordless test login. Local development only.`,
      `AUTH_MODE=dev`,
      "",
    ].join("\n"),
  );
  console.log("[ensure-db] wrote .env");
} else if (!/^AUTH_MODE=/m.test(readFileSync(envPath, "utf8"))) {
  appendFileSync(envPath, `\nAUTH_MODE=dev\n`);
  console.log("[ensure-db] added AUTH_MODE=dev to .env");
}

nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== "production");

const prismaCli = resolve(root, "node_modules/prisma/build/index.js");
function prisma(...args: string[]) {
  const r = spawnSync(process.execPath, [prismaCli, ...args], { cwd: root, stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`[ensure-db] prisma ${args.join(" ")} failed`);
    process.exit(r.status ?? 1);
  }
}

const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const generatedSchemaPath = resolve(root, "node_modules/.prisma/client/schema.prisma");
const generated = existsSync(generatedSchemaPath) ? readFileSync(generatedSchemaPath, "utf8") : "";
if (generated.replace(/\r\n/g, "\n") !== schema.replace(/\r\n/g, "\n")) prisma("generate");

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

/**
 * SQLite migrations are not transactional, so a failed one can leave the file
 * half-migrated (KTD15). Before applying pending migrations to a database that
 * has users, write a consistent copy; VACUUM INTO also captures the WAL.
 */
async function backupBeforeMigrating() {
  const applied = await db
    .$queryRawUnsafe<{ migration_name: string }[]>(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`)
    .catch(() => null);
  if (!applied) return null; // fresh database: nothing to protect
  const done = new Set(applied.map((r) => r.migration_name));
  const pending = readdirSync(resolve(root, "prisma/migrations"), { withFileTypes: true }).filter((d) => d.isDirectory() && !done.has(d.name));
  if (!pending.length) return null;
  const users = await db.$queryRawUnsafe<{ n: number | bigint }[]>(`SELECT count(*) AS n FROM "User"`).catch(() => [{ n: 0 }]);
  if (Number(users[0]?.n ?? 0) === 0) return null;
  const dir = resolve(root, "prisma/backups");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `dev-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  console.log(`[ensure-db] backed up the database to ${file} before migrating`);
  return file;
}

const backup = await backupBeforeMigrating();
await db.$disconnect();

const deployed = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { cwd: root, stdio: "inherit", env: process.env });
if (deployed.status !== 0) {
  console.error("[ensure-db] prisma migrate deploy failed");
  if (backup) {
    console.error(
      [
        "[ensure-db] To roll back: stop every server, copy the backup over prisma/dev.db,",
        "  delete prisma/dev.db-wal and prisma/dev.db-shm, and check out the commit before the new migration.",
        `  Backup: ${backup}`,
      ].join("\n"),
    );
  }
  process.exit(deployed.status ?? 1);
}

const { seedDatabase } = await import("../src/server/seed-runner");
try {
  await db.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  if ((await db.user.count()) === 0) {
    // All-or-nothing: a half-seeded database would never be reseeded (the check above is on users).
    await db.$transaction((tx) => seedDatabase(tx), { timeout: 120_000, maxWait: 10_000 });
    console.log("[ensure-db] seeded database");
  }
} finally {
  await db.$disconnect();
}
