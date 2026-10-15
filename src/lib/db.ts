import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __lowercasePrisma?: PrismaClient };

/** One Prisma client per process; cached on globalThis so dev reloads and the custom server share it. */
export const db: PrismaClient = globalForPrisma.__lowercasePrisma ?? new PrismaClient();
globalForPrisma.__lowercasePrisma = db;

export type Db = PrismaClient;
