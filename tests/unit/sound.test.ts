import { beforeEach, describe, expect, it, vi } from "vitest";

/** A minimal Web Audio stand-in that records what the player does. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  static resumeFails = false;
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = {};
  oscillators = 0;
  resumes = 0;
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  resume() {
    this.resumes++;
    return FakeAudioContext.resumeFails ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve().then(() => void (this.state = "running"));
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (d: unknown) => d };
  }
  createOscillator() {
    this.oscillators++;
    return { type: "", frequency: { value: 0 }, connect: (g: { connect: (d: unknown) => unknown }) => g, start() {}, stop() {} };
  }
}

const storage = new Map<string, string>();
Object.assign(globalThis, {
  AudioContext: FakeAudioContext,
  localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) },
});

const { play } = await import("@/lib/sound");
const { useSound, hydrateSound, applyStorageEvent, setSoundPreference, soundStorageKey } = await import("@/stores/sound");

beforeEach(() => {
  FakeAudioContext.resumeFails = false;
  storage.clear();
  hydrateSound("user-a", true);
});

describe("sound player (R16)", () => {
  const oscillators = () => FakeAudioContext.instances.reduce((n, c) => n + c.oscillators, 0);

  it("plays nothing, and creates no audio context, when sound is off", () => {
    useSound.getState().setEnabled(false);
    play("correct");
    expect(FakeAudioContext.instances).toHaveLength(0);
    expect(oscillators()).toBe(0);
  });

  it("checks the setting at the moment of playing", () => {
    play("correct");
    expect(oscillators()).toBe(2);
    useSound.getState().setEnabled(false);
    play("correct");
    expect(oscillators()).toBe(2);
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("resumes a suspended context and swallows a browser refusal", async () => {
    FakeAudioContext.resumeFails = true;
    play("correct"); // make sure a context exists, then simulate the browser suspending it
    const [audio] = FakeAudioContext.instances;
    audio.state = "suspended";
    audio.resumes = 0;
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    expect(() => play("correct")).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", unhandled);
    expect(audio.resumes).toBe(1);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe("sound preference (R14, R15)", () => {
  it("lets the account value win over a stale browser copy on load", () => {
    storage.set(soundStorageKey("user-a"), "true");
    hydrateSound("user-a", false);
    expect(useSound.getState().enabled).toBe(false);
    expect(storage.get(soundStorageKey("user-a"))).toBe("false");
  });

  it("follows a change made in another tab for the same user only", () => {
    applyStorageEvent(soundStorageKey("user-a"), "false");
    expect(useSound.getState().enabled).toBe(false);
    applyStorageEvent(soundStorageKey("user-b"), "true");
    expect(useSound.getState().enabled).toBe(false);
    applyStorageEvent(soundStorageKey("user-a"), "true");
    expect(useSound.getState().enabled).toBe(true);
  });

  it("flips at once, mirrors to other tabs, and flips back if the save fails", async () => {
    let resolveSave!: (v: { ok: boolean }) => void;
    const pending = setSoundPreference(false, () => new Promise((r) => (resolveSave = r)));
    expect(useSound.getState().enabled).toBe(false);
    expect(storage.get(soundStorageKey("user-a"))).toBe("false");
    resolveSave({ ok: false });
    expect(await pending).toBe(false);
    expect(useSound.getState().enabled).toBe(true);
    expect(storage.get(soundStorageKey("user-a"))).toBe("true");
  });

  it("keeps the new value when the save succeeds", async () => {
    expect(await setSoundPreference(false, async () => ({ ok: true }))).toBe(true);
    expect(useSound.getState().enabled).toBe(false);
  });
});
