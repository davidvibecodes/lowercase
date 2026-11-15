import { Prisma } from "@prisma/client";
import type { z } from "zod";

export class ServiceError extends Error {}

/** A unique-index violation: the database decided a race (P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Validates input with a zod schema, surfacing the first issue as a ServiceError. */
export function parseInput<T>(schema: z.ZodType<T>, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new ServiceError(r.error.issues[0]?.message ?? "Invalid input");
  return r.data;
}
