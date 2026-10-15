/**
 * Bootstraps a local database (KTD12): writes .env if missing, generates the
 * Prisma client when the schema changed, applies migrations, enables WAL and
 * seeds an empty database. Safe to run repeatedly.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
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

prisma("migrate", "deploy");

const { PrismaClient } = await import("@prisma/client");
const { seedDatabase } = await import("../src/server/seed-runner");
const db = new PrismaClient();
try {
  await db.$queryRawUnsafe("PRAGMA journal_mode=WAL;");
  if ((await db.user.count()) === 0) {
    await seedDatabase(db);
    console.log("[ensure-db] seeded database");
  }
} finally {
  await db.$disconnect();
}
