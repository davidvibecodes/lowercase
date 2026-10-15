"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/concepts", label: "Concepts & Quizzes" },
  { href: "/admin/cases", label: "Cases & Issue Trees" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Admin CMS</h1>
      <nav aria-label="Admin" className="inline-flex gap-1 rounded-2xl border border-line bg-obsidian p-1">
        {LINKS.map((l) => {
          const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("rounded-xl px-3.5 py-2 text-sm font-bold", active ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
