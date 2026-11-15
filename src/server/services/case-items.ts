import { keysToJson } from "@/lib/node-keys";
import type { GateFields } from "@/lib/types";

/**
 * The casebank columns of a CaseItem row, from an editor item or an imported
 * one. Empty strings become null so both writers store the same thing.
 */
export function itemColumns(item: GateFields & { category?: string | null; nodeKey?: string | null }) {
  return {
    category: item.category || null,
    nodeKey: item.nodeKey || null,
    gatePrereqKeys: keysToJson(item.gatePrereqKeys),
    gateTrigger: item.gateTrigger || null,
    gateAntiLeak: item.gateAntiLeak || null,
    gateNudge: item.gateNudge || null,
  };
}
