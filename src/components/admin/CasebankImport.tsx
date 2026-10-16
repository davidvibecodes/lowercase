"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileJson, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CASEBANK_MAX_BYTES } from "@/lib/types";
import type { CaseOutcome, CasePreview, ImportResult } from "@/server/services/casebank";

type State =
  | { step: "pick" }
  | { step: "error"; errors: string[] }
  | { step: "preview"; cases: CasePreview[] }
  | { step: "done"; cases: CasePreview[]; outcomes: CaseOutcome[] };

async function send(document: unknown, dryRun: boolean): Promise<ImportResult> {
  const res = await fetch("/api/admin/casebank", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dryRun, document }) });
  if (res.status === 403) return { ok: false, errors: ["Only the admin can import casebanks."] };
  try {
    return (await res.json()) as ImportResult;
  } catch {
    return { ok: false, errors: [`The import failed (HTTP ${res.status}). Try again.`] };
  }
}

/** Admin → Cases → Import (R24): pick a 2.0.0 JSON file, preview, confirm, see each case's outcome. */
export function CasebankImport() {
  const [state, setState] = useState<State>({ step: "pick" });
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const doc = useRef<unknown>(null);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const r = await send(doc.current, dryRun);
      if (!r.ok) setState({ step: "error", errors: r.errors });
      else if (dryRun) setState({ step: "preview", cases: r.cases });
      else setState({ step: "done", cases: r.cases, outcomes: r.outcomes });
    } catch {
      setState({ step: "error", errors: ["Couldn't reach the server. Try again."] });
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    if (file.size > CASEBANK_MAX_BYTES) return setState({ step: "error", errors: ["The file is larger than 2 MB."] });
    try {
      doc.current = JSON.parse(await file.text());
    } catch {
      return setState({ step: "error", errors: ["That file isn't valid JSON."] });
    }
    await run(true);
  };

  const preview = state.step === "preview" || state.step === "done" ? state.cases : [];
  const blocked = preview.filter((c) => c.blocked).length;

  return (
    <div className="space-y-6">
      <Link href="/admin/cases" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> All cases
      </Link>
      <Card className="p-6">
        <h1 className="text-xl font-extrabold">Import a casebank</h1>
        <p className="mt-1 text-sm text-muted">
          Choose a casebank JSON file (schema 2.0.0). You&apos;ll see what changes before anything is saved. Importing the same file again updates those cases in place. Edits you made in the CMS to imported facts, hints, recommendations and
          lists are overwritten, and items you added to those lists are archived.
        </p>
        <p className="mt-2 text-xs text-faint">The file is read in your browser and sent only to this app. Keep licensed casebanks out of git, e.g. in content/private/.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input type="file" accept="application/json,.json" className="sr-only" id="casebank-file" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
          <label
            htmlFor="casebank-file"
            aria-disabled={busy}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-2xl bg-royal px-5 text-[15px] font-bold text-white aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            <FileJson size={18} aria-hidden /> {fileName ? "Choose another file" : "Choose file"}
          </label>
          {fileName && <span className="text-sm font-semibold text-muted">{fileName}</span>}
          {busy && <span className="text-sm font-bold text-faint" role="status">Working…</span>}
        </div>
      </Card>

      {state.step === "error" && (
        <Card className="border-amber/50 p-6" role="alert">
          <h2 className="flex items-center gap-2 font-extrabold text-amber">
            <AlertTriangle size={18} aria-hidden /> This file can&apos;t be imported
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Card>
      )}

      {(state.step === "preview" || state.step === "done") && (
        <Card className="overflow-hidden">
          <div className="border-b border-line p-4 sm:px-6">
            <h2 className="text-lg font-extrabold">{state.step === "preview" ? "Preview" : "Result"}</h2>
            {state.step === "preview" && (
              <p className="text-sm text-faint">
                {preview.filter((c) => c.action === "create").length} to create, {preview.filter((c) => c.action === "update").length} to update
                {blocked ? `, ${blocked} blocked` : ""}.
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-faint">
                <tr>
                  <th className="px-4 py-2 sm:px-6">Case</th>
                  <th className="px-2 py-2">{state.step === "preview" ? "Will" : "Outcome"}</th>
                  <th className="px-2 py-2">Facts</th>
                  <th className="px-2 py-2">Nodes</th>
                  <th className="px-2 py-2">Hints</th>
                  <th className="px-2 py-2">Recs</th>
                  <th className="px-2 py-2">Turns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.map((c) => {
                  const outcome = state.step === "done" ? state.outcomes.find((o) => o.externalId === c.externalId) : undefined;
                  return (
                    <tr key={c.externalId}>
                      <td className="px-4 py-3 sm:px-6">
                        <p className="font-bold">{c.title}</p>
                        <p className="text-xs text-faint">{c.externalId}</p>
                        {c.blocked && state.step === "preview" && <p className="mt-1 text-xs font-bold text-amber">Blocked: {c.blocked}</p>}
                        {outcome?.reason && <p className="mt-1 text-xs font-bold text-amber">{outcome.reason}</p>}
                      </td>
                      <td className="px-2 py-3 font-bold">
                        {outcome ? (
                          outcome.status === "applied" ? (
                            <span className="inline-flex items-center gap-1 text-emerald">
                              <CheckCircle2 size={15} aria-hidden /> Applied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber">
                              <XCircle size={15} aria-hidden /> Failed
                            </span>
                          )
                        ) : c.blocked ? (
                          <span className="text-amber">Skip</span>
                        ) : (
                          <span className={c.action === "create" ? "text-emerald" : "text-royal-bright"}>{c.action === "create" ? "Create" : "Update"}</span>
                        )}
                      </td>
                      <td className="px-2 py-3 tabular-nums">{c.counts.facts}</td>
                      <td className="px-2 py-3 tabular-nums">{c.counts.nodes}</td>
                      <td className="px-2 py-3 tabular-nums">{c.counts.hints}</td>
                      <td className="px-2 py-3 tabular-nums">{c.counts.recommendations}</td>
                      <td className="px-2 py-3 tabular-nums">{c.counts.turns}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line p-4 sm:px-6">
            {state.step === "preview" ? (
              <Button disabled={busy || blocked === preview.length} onClick={() => void run(false)}>
                Confirm import
              </Button>
            ) : (
              <>
                <Link href="/admin/cases" className="inline-flex h-11 items-center rounded-2xl bg-royal px-5 text-[15px] font-bold text-white">
                  Go to cases
                </Link>
                {state.outcomes.some((o) => o.status === "failed") && (
                  <Button variant="secondary" disabled={busy} onClick={() => void run(false)}>
                    <RotateCcw size={16} aria-hidden /> Retry import
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
