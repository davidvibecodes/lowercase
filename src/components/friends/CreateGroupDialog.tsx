"use client";

import { useState, useTransition } from "react";
import { createGroupAction } from "@/app/(app)/friends/actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import type { PersonRef } from "@/lib/realtime/events";

/** R21: checked friends get an invite they can accept or decline; nobody is added without asking. */
export function CreateGroupDialog({ open, onClose, friends }: { open: boolean; onClose: () => void; friends: PersonRef[] }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await createGroupAction(name, members);
      if (!r.ok) return setError(r.error);
      toast(members.length ? `Created ${name.trim()} and sent ${members.length} ${members.length === 1 ? "invite" : "invites"}` : `Created ${name.trim()}`, "success");
      setName("");
      setMembers([]);
      setError(null);
      onClose();
    });
  return (
    <Modal open={open} onClose={onClose} title="Create a study group">
      <label className="block text-sm font-bold text-muted" htmlFor="group-name">
        Group name
      </label>
      <input
        id="group-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line-strong bg-obsidian px-3 font-semibold outline-none focus:border-royal-bright"
        data-autofocus
      />
      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-muted">Invite friends</legend>
        <p className="text-xs text-faint">They&apos;ll get an invite to accept in their Received tab.</p>
        {friends.length === 0 && <p className="mt-2 text-sm text-muted">Add friends first to invite them.</p>}
        <div className="mt-2 space-y-1.5">
          {friends.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-royal-bright)]"
                checked={members.includes(f.id)}
                onChange={(e) => setMembers((m) => (e.target.checked ? [...m, f.id] : m.filter((x) => x !== f.id)))}
              />
              {f.firstName} {f.lastName} <span className="text-faint">@{f.username}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-amber">
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={pending} onClick={submit}>
          Create
        </Button>
      </div>
    </Modal>
  );
}
