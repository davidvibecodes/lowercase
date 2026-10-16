"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Search, UserPlus } from "lucide-react";
import { cancelFriendRequestAction, respondFriendRequestAction, searchPeopleAction, sendFriendRequestAction } from "@/app/(app)/friends/actions";
import { Avatar } from "@/components/home/Avatar";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { PersonResult } from "@/server/services/social";

/** Find people only by their exact username (R17); an empty search shows a prompt, never a list. */
export function SearchPanel({ username }: { username: string }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PersonResult | null | undefined>(undefined);
  const [busy, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);
  const term = query.trim().replace(/^@/, "");

  const lookup = async (q: string) => {
    const id = ++seq.current;
    const r = await searchPeopleAction(q);
    if (id === seq.current) setResult(r);
  };

  useEffect(() => {
    if (!term) {
      seq.current++;
      setResult(undefined);
      return;
    }
    const t = window.setTimeout(() => void lookup(term), 300);
    return () => window.clearTimeout(t);
  }, [term]);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast(r.error ?? "Something went wrong", "warning");
      else toast(ok, "success");
      await lookup(term);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Couldn't copy. Your username is @" + username, "warning");
    }
  };

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search by username</span>
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by exact username, e.g. @roy"
          autoCapitalize="none"
          spellCheck={false}
          className="h-12 w-full rounded-2xl border border-line-strong bg-surface pl-11 pr-4 font-semibold outline-none focus:border-royal-bright"
        />
      </label>

      {!term && (
        <div className="mt-6 rounded-3xl border border-dashed border-line px-6 py-8 text-center">
          <p className="font-bold">Search by a user&apos;s unique username to find and invite them</p>
          <p className="mt-1 text-sm text-muted">There&apos;s no list of everyone here. Share your own handle so friends can find you:</p>
          <button
            type="button"
            onClick={copy}
            className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-2 font-bold hover:border-line-strong"
          >
            @{username} {copied ? <Check size={16} className="text-emerald" aria-hidden /> : <Copy size={16} aria-hidden />}
            <span className="sr-only">{copied ? "Copied" : "Copy your username"}</span>
          </button>
        </div>
      )}

      {term && result === null && (
        <p className="mt-6 text-muted" role="status">
          No one has the username @{term.toLowerCase()}. Usernames must match exactly.
        </p>
      )}

      {term && result && (
        <div data-testid="search-result" className="mt-6 flex items-center gap-4 rounded-3xl border border-line bg-surface px-4 py-3.5">
          <Avatar first={result.person.firstName} last={result.person.lastName} src={result.person.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">
              {result.person.firstName} {result.person.lastName}
            </p>
            <p className="truncate text-sm text-faint">@{result.person.username}</p>
          </div>
          {result.relationship === "friends" && <span className="text-sm font-bold text-emerald">Friends</span>}
          {result.relationship === "none" && (
            <Button size="sm" disabled={busy} onClick={() => act(() => sendFriendRequestAction(result.person.username), `Request sent to ${result.person.firstName}`)}>
              <UserPlus size={16} aria-hidden /> Add friend
            </Button>
          )}
          {result.relationship === "outgoing" && result.requestId && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => cancelFriendRequestAction(result.requestId!), "Request cancelled")}>
              Requested · Cancel
            </Button>
          )}
          {result.relationship === "incoming" && result.requestId && (
            <div className="flex gap-2">
              <Button size="sm" variant="success" disabled={busy} onClick={() => act(() => respondFriendRequestAction(result.requestId!, true), `You and ${result.person.firstName} are friends`)}>
                Accept
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => respondFriendRequestAction(result.requestId!, false), "Request declined")}>
                Decline
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
