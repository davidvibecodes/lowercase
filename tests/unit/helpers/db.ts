import { db } from "@/lib/db";
import { seedDatabase } from "@/server/seed-runner";

/** Empties every table and reseeds, so each suite starts from seed state. */
export async function resetAndSeed(now = new Date()) {
  const tables = await db.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%'",
  );
  await db.$executeRawUnsafe("PRAGMA foreign_keys = OFF;");
  for (const t of tables) await db.$executeRawUnsafe(`DELETE FROM "${t.name}";`);
  await db.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  await seedDatabase(db, now);
}

export async function userId(username: string) {
  return (await db.user.findUniqueOrThrow({ where: { username } })).id;
}

export { db };
