"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { resetConceptMasteryAction } from "@/app/(focus)/learn/[conceptId]/actions";

export function MasteredState({ concept, total }: { concept: { id: string; slug: string; title: string }; total: number }) {
  const [pending, start] = useTransition();
  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-lg place-items-center px-4 text-center">
      <div>
        <span className="mx-auto grid size-20 place-items-center rounded-3xl bg-emerald-soft text-emerald">
          <Trophy size={40} aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Mastered</h1>
        <p className="mt-2 text-muted">
          You&apos;ve answered all {total} questions in <strong className="text-ink">{concept.title}</strong> correctly. Mastered questions aren&apos;t served again.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/learn" className="inline-flex h-11 items-center rounded-2xl border border-line bg-surface-2 px-5 font-bold hover:bg-surface-3">
            Back to Learn
          </Link>
          <Button variant="warning" disabled={pending} onClick={() => start(() => resetConceptMasteryAction(concept.id, concept.slug))}>
            Reset this concept
          </Button>
        </div>
      </div>
    </main>
  );
}
