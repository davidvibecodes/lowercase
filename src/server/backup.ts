/**
 * Hosted databases keep a rolling set of consistent copies on the same disk:
 * one shortly after start and then daily, newest 7 kept. They protect against
 * a bad migration, a bug or a deleted row. They do not protect against losing
 * the disk itself, so copy them somewhere else too (see docs/hosting.md).
 */
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "@/lib/db";
import { hostedBackupDir } from "./db-file";

const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60_000;
export const KEEP_BACKUPS = 7;
const NAME = /^lowercase-.+\.db$/;

/** Writes one backup and prunes the oldest. Returns its path, or null when the database isn't a local file. */
export async function backupNow(now = new Date()): Promise<string | null> {
  const dir = hostedBackupDir(process.env.DATABASE_URL, resolve(process.cwd(), "prisma"));
  if (!dir) return null;
  await mkdir(dir, { recursive: true });
  const file = join(dir, `lowercase-${now.toISOString().replace(/[:.]/g, "-")}.db`);
  // VACUUM INTO reads through the WAL, so the copy is consistent while the app keeps writing.
  await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const old = (await readdir(dir)).filter((n) => NAME.test(n)).sort().slice(0, -KEEP_BACKUPS);
  await Promise.all(old.map((n) => rm(join(dir, n), { force: true })));
  return file;
}

async function run() {
  try {
    const file = await backupNow();
    if (file) console.log(`[backup] wrote ${file}`);
  } catch (e) {
    console.error("[backup] failed:", e);
  }
}

export function startBackups() {
  setTimeout(run, FIRST_RUN_DELAY_MS).unref();
  setInterval(run, DAY_MS).unref();
}
