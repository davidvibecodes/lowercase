"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { useUser } from "@/lib/auth/AuthProvider";
import { signOutAction } from "@/lib/auth/actions";
import { disconnectSocket } from "@/lib/realtime/socket";

export function AccountMenu() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-ink hover:bg-surface-2";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-2"
      >
        <Menu size={22} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-64 rounded-2xl border border-line bg-surface p-2 shadow-2xl">
          <div className="px-3 pb-2 pt-1">
            <p className="font-extrabold">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-sm text-faint">@{user.username}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href="/settings#preferences" className={item} onClick={() => setOpen(false)}>
            <Settings size={18} aria-hidden /> Settings
          </Link>
          <Link role="menuitem" href="/settings" className={item} onClick={() => setOpen(false)}>
            <UserRound size={18} aria-hidden /> Account
          </Link>
          {user.isAdmin && (
            <Link role="menuitem" href="/admin" className={item} onClick={() => setOpen(false)}>
              <LayoutDashboard size={18} aria-hidden /> Admin Panel
            </Link>
          )}
          <form action={signOutAction} onSubmit={() => disconnectSocket()}>
            <button role="menuitem" type="submit" className={item}>
              <LogOut size={18} aria-hidden /> Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
