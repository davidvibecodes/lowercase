"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SolvedChartInner({ data }: { data: Array<{ label: string; solved: number }> }) {
  return (
    <div className="h-56 w-full" role="img" aria-label={`Problems solved: ${data.map((d) => `${d.label} ${d.solved}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#262936" />
          <XAxis dataKey="label" tick={{ fill: "#a3a9b8", fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#8a90a2", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "#ffffff0d" }}
            contentStyle={{ background: "#14161d", border: "1px solid #262936", borderRadius: 12, color: "#f4f5f7", fontWeight: 700 }}
            formatter={(v) => [v, "Solved"]}
          />
          <Bar dataKey="solved" fill="#22c55e" radius={[8, 8, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
