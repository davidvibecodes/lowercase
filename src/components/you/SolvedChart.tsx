"use client";

import dynamic from "next/dynamic";

/** recharts loads only on /you (KTD8). */
export const SolvedChart = dynamic(() => import("./SolvedChartInner"), {
  ssr: false,
  loading: () => <div className="h-56 animate-pulse rounded-2xl bg-surface-2" />,
});
