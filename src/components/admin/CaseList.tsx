"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import { createCaseAction } from "@/app/(app)/admin/cases/actions";
import { CASE_TYPES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/types";

type Row = { id: string; title: string; caseType: string; difficulty: number; published: boolean; nodes: number; turns: number };

export function CaseList({ cases }: { cases: Row[] }) {
  const [type, setType] = useState<string>("All");
  const [pending, start] = useTransition();
  const router = useRouter();
  const shown = cases.filter((c) => type === "All" || c.caseType === type);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filter by type" size="sm" value={type} onChange={setType} options={["All", ...CASE_TYPES].map((t) => ({ value: t, label: t }))} />
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await createCaseAction({ title: "Untitled case", caseType: "Profitability", difficulty: 1, problemStatement: "Describe the client's problem.", published: false });
              if (!r.ok) return toast(r.error, "warning");
              router.push(`/admin/cases/${r.id}`);
            })
          }
        >
          <Plus size={18} aria-hidden /> New Case
        </Button>
      </div>
      <ul className="space-y-2.5">
        {shown.map((c) => (
          <li key={c.id} className="flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">
                {c.title} {!c.published && <span className="ml-1 rounded-full bg-surface-3 px-2 py-0.5 text-xs text-faint">Draft</span>}
              </p>
              <p className="text-sm text-faint">
                {c.caseType} · {DIFFICULTY_LABEL[c.difficulty as Difficulty]} · {c.nodes} tree nodes · {c.turns} transcript turns
              </p>
            </div>
            <Link href={`/admin/cases/${c.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-muted hover:bg-surface-2 hover:text-ink">
              <Pencil size={16} aria-hidden /> Edit
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
