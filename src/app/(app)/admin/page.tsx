import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Briefcase, HelpCircle, Users } from "lucide-react";
import { db } from "@/lib/db";
import { ResetMasteryTool } from "@/components/admin/ResetMasteryTool";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const [concepts, questions, cases, users, conceptList] = await Promise.all([
    db.concept.count(),
    db.question.count(),
    db.case.count(),
    db.user.count({ where: { isLeagueBot: false } }),
    db.concept.findMany({ orderBy: { order: "asc" }, select: { id: true, title: true } }),
  ]);
  const tiles = [
    { label: "Concepts", value: concepts, icon: BookOpen, href: "/admin/concepts" },
    { label: "Questions", value: questions, icon: HelpCircle, href: "/admin/concepts" },
    { label: "Cases", value: cases, icon: Briefcase, href: "/admin/cases" },
    { label: "Learners", value: users, icon: Users, href: "/friends" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-3xl border border-line bg-surface p-5 hover:border-line-strong">
            <Icon className="text-royal-bright" aria-hidden />
            <p className="mt-3 text-3xl font-extrabold tabular-nums">{value}</p>
            <p className="text-sm font-bold text-faint">{label}</p>
          </Link>
        ))}
      </div>
      <ResetMasteryTool concepts={conceptList} />
    </div>
  );
}
