import type { CaseSeed } from "../../../src/lib/types";
import { additionalCases } from "./additional";
import { diagnosticMumbai } from "./diagnostic-mumbai";

/** Every case seeded into a fresh database, local or hosted. */
export const caseSeeds: CaseSeed[] = [diagnosticMumbai, ...additionalCases];
