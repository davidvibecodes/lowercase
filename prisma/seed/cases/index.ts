import type { CaseSeed } from "../../../src/lib/types";
import { additionalCases } from "./additional";
import { diagnosticMumbai } from "./diagnostic-mumbai";

/** Every case the local database is seeded with, including the licensed Mumbai one. */
export const caseSeeds: CaseSeed[] = [diagnosticMumbai, ...additionalCases];

/** Cases written for this app. A public site seeds only these: the Mumbai case is licensed casebook content. */
export const publicCaseSeeds: CaseSeed[] = additionalCases;
