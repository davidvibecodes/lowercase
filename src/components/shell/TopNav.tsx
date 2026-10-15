"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, LayoutDashboard, User, Users } from "lucide-react";
import { useUser } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/cn";
import { AccountMenu } from "./AccountMenu";
import { OnlineBadge } from "./OnlineBadge";
import { StreakPill, XpPill } from "./Pills";
import { Wordmark } from "./Wordmark";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/friends", label: "Friends & Groups", icon: Users },
  { href: "/you", label: "You", icon: User },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ xp, streak }: { xp: number; streak: number }) {
  const pathname = usePathname();
  const user = useUser();
  const tabs = user.isAdmin ? [...TABS, { href: "/admin", label: "Admin CMS", icon: LayoutDashboard }] : TABS;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-obsidian/90 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="lowercase home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="ml-2 flex min-w-0 flex-1 items-stretch gap-1 self-stretch overflow-x-auto [scrollbar-width:none]">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 px-3 text-[15px] font-bold transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Icon size={18} aria-hidden />
                <span className="hidden lg:inline">{label}</span>
                <span className="sr-only lg:hidden">{label}</span>
                {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-emerald" aria-hidden />}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <OnlineBadge />
          <StreakPill initial={streak} />
          <XpPill initial={xp} />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
