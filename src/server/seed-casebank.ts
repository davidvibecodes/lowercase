/**
 * The owner's own casebank (prisma/seed/casebank.json, schema 2.0.0) ships with
 * the app, so a fresh hosted database starts with those cases. It goes through
 * the same importer as Admin → Cases → Import.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Db } from "@/lib/db";
import { importCasebank, type ImportResult } from "./services/casebank";

export const BUNDLED_CASEBANK_PATH = resolve(import.meta.dirname, "../../prisma/seed/casebank.json");

export function readBundledCasebank(): unknown {
  return JSON.parse(readFileSync(BUNDLED_CASEBANK_PATH, "utf8"));
}

/** Imports the bundled casebank. Needs the full client, not a transaction: the importer opens one per case. */
export async function seedBundledCasebank(db: Db): Promise<ImportResult> {
  return importCasebank(db, readBundledCasebank(), { dryRun: false });
}
