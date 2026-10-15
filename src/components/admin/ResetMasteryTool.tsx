"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { toast } from "@/components/ui/Toast";
import { resetConceptMasteryAction } from "@/app/(app)/admin/concepts/actions";

export function ResetMasteryTool({ concepts }: { concepts: Array<{ id: string; title: string }> }) {
  const [id, setId] = useState(concepts[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <Card className="p-6">
      <h2 className="text-lg font-extrabold">Reset mastery for a concept</h2>
      <p className="mb-4 text-sm text-muted">Every learner can be served this concept&apos;s questions again. Useful for testing.</p>
      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="reset-concept">
          Concept
        </label>
        <select id="reset-concept" value={id} onChange={(e) => setId(e.target.value)} className="h-11 rounded-xl border border-line-strong bg-obsidian px-3 font-bold text-ink">
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <Button
          variant="warning"
          disabled={!id || pending}
          onClick={() =>
            start(async () => {
              const r = await resetConceptMasteryAction(id);
              toast(r.ok ? `Reset ${r.count} mastered answers` : r.error, r.ok ? "success" : "warning");
            })
          }
        >
          Reset mastery
        </Button>
      </div>
    </Card>
  );
}
