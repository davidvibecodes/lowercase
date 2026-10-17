import { dirname, isAbsolute, resolve } from "node:path";

/** Absolute path of the SQLite file a DATABASE_URL names. Relative paths resolve from prisma/, as Prisma does. */
export function dbFilePath(url: string | undefined, prismaDir: string): string | null {
  if (!url?.startsWith("file:")) return null;
  const path = url.slice("file:".length).split("?")[0];
  if (!path) return null;
  return isAbsolute(path) ? path : resolve(prismaDir, path);
}

/** Where hosted backups live: a folder beside the database file, so they sit on the same persistent disk. */
export function hostedBackupDir(url: string | undefined, prismaDir: string): string | null {
  const file = dbFilePath(url, prismaDir);
  return file ? resolve(dirname(file), "backups") : null;
}
