"use client";

import dynamic from "next/dynamic";

/** React Flow and dagre load only on pages that draw a tree (KTD8). */
export const LazyIssueTree = dynamic(() => import("./IssueTree"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center text-sm text-faint">Loading issue tree…</div>,
});
