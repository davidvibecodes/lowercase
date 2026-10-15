import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../src/server/seed-runner";

const db = new PrismaClient();

const existing = await db.user.count();
if (existing > 0) {
  console.log(`Seed skipped: database already has ${existing} users.`);
} else {
  await db.$transaction((tx) => seedDatabase(tx), { timeout: 120_000, maxWait: 10_000 });
  console.log("Seeded lowercase database.");
}
await db.$disconnect();
