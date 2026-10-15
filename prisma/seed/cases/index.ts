import type { CaseSeed } from "../../../src/lib/types";
import { additionalCases } from "./additional";
import { diagnosticMumbai } from "./diagnostic-mumbai";

export const caseSeeds: CaseSeed[] = [diagnosticMumbai, ...additionalCases];
