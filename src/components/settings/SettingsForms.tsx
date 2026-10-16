"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Tabs";
import { toast } from "@/components/ui/Toast";
import {
  resetMasteryAction,
  resetProgressAction,
  setGateModeAction,
  updateAccountAction,
  updatePreferencesAction,
  type SettingsResult,
} from "@/app/(app)/settings/actions";
import type { GateMode } from "@/lib/types";
import { setSoundPreference, useSound } from "@/stores/sound";

const input = "mt-1 h-11 w-full rounded-xl border border-line-strong bg-obsidian px-3 font-semibold outline-none focus:border-royal-bright";

function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (fn: () => Promise<SettingsResult>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast(ok, "success");
        router.refresh();
      } else toast(r.error, "warning");
    });
  return { pending, go };
}

export function AccountForm({ user }: { user: { firstName: string; lastName: string; email: string; username: string } }) {
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName });
  const { pending, go } = useAction();
  return (
    <Card className="mt-6 p-6">
      <h2 className="text-lg font-extrabold">Profile</h2>
      <p className="text-sm text-faint">@{user.username}</p>
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          go(() => updateAccountAction(form), "Account saved");
        }}
      >
        <label className="text-sm font-bold text-muted">
          First name
          <input className={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>
        <label className="text-sm font-bold text-muted">
          Last name
          <input className={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>
        <label className="text-sm font-bold text-muted sm:col-span-2">
          Email
          <input className={`${input} cursor-not-allowed opacity-70`} type="email" value={user.email} readOnly aria-describedby="email-source" />
          <span id="email-source" className="mt-1 block text-xs font-semibold text-faint">
            From your Google account
          </span>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-faint">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={"relative h-7 w-12 shrink-0 rounded-full transition-colors " + (checked ? "bg-emerald" : "bg-surface-3")}
      >
        <span className={"absolute top-1 size-5 rounded-full bg-white transition-transform " + (checked ? "translate-x-6" : "translate-x-1")} />
      </button>
    </label>
  );
}

export function Preferences({ soundOn: initialSound, reducedMotion }: { soundOn: boolean; reducedMotion: boolean }) {
  const [prefs, setPrefs] = useState({ reducedMotion });
  // The switch renders from the shared store, so a change in another tab moves it too (R15).
  // Until the shell has hydrated the store, show the account value instead of the store's default.
  const soundOn = useSound((s) => (s.userId ? s.enabled : initialSound));
  const toggleSound = async (on: boolean) => {
    const ok = await setSoundPreference(on, () => updatePreferencesAction({ soundOn: on }));
    toast(ok ? "Preferences saved" : "Couldn't save the sound setting. Try again.", ok ? "success" : "warning");
  };
  const { go } = useAction();
  const update = (p: Partial<typeof prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    go(() => updatePreferencesAction(next), "Preferences saved");
  };
  return (
    <Card className="mt-6 p-6" id="preferences">
      <h2 className="text-lg font-extrabold">Preferences</h2>
      <div className="mt-2 divide-y divide-line">
        <Toggle label="Sound effects" description="Chime on a correct answer." checked={soundOn} onChange={(v) => void toggleSound(v)} />
        <Toggle label="Reduce motion" description="Minimize animations (your OS setting is always respected)." checked={prefs.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
      </div>
    </Card>
  );
}

export function TestingControls({ isAdmin, gateMode }: { isAdmin: boolean; gateMode: string }) {
  const [mode, setMode] = useState(gateMode as GateMode);
  const [confirm, setConfirm] = useState(false);
  const { pending, go } = useAction();
  return (
    <Card className="mt-6 p-6">
      <h2 className="text-lg font-extrabold">Data &amp; testing</h2>
      <p className="text-sm text-faint">Controls for local testing.</p>
      {isAdmin && (
        <div className="mt-5">
          <p className="mb-2 text-sm font-bold text-muted">Progress gates</p>
          <Segmented
            label="Progress gate mode"
            value={mode}
            onChange={(m) => {
              setMode(m);
              go(() => setGateModeAction(m), "Gate mode updated");
            }}
            options={[
              { value: "auto", label: "Follow rules" },
              { value: "forceUnlocked", label: "Unlock all" },
              { value: "forceLocked", label: "Lock all" },
            ]}
          />
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="/api/export" download className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 text-[15px] font-bold hover:bg-surface-3">
          <Download size={18} aria-hidden /> Export my data
        </a>
        <Button variant="secondary" disabled={pending} onClick={() => go(resetMasteryAction, "Quiz mastery reset")}>
          <RotateCcw size={18} aria-hidden /> Reset quiz mastery
        </Button>
        <Button variant="warning" disabled={pending} onClick={() => setConfirm(true)}>
          Reset all my progress
        </Button>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset all progress?">
        <p className="text-muted">Your XP, streak, quiz history and case results go back to their seeded state. This can&apos;t be undone.</p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="warning"
            className="flex-1"
            onClick={() => {
              setConfirm(false);
              go(resetProgressAction, "Progress reset");
            }}
          >
            Reset
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
