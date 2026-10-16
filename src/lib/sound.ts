"use client";

import { useSound } from "@/stores/sound";

/**
 * The one sound player (R16, KTD14). Every effect goes through play(), which
 * reads the preference at the moment of playing, so a change in any tab
 * applies to the next sound. Audio is a nicety: refusals are swallowed.
 */
export type SoundName = "correct";

let ctx: AudioContext | null = null;

const TONES: Record<SoundName, number[]> = {
  correct: [660, 990], // short two-note chime
};

export function play(name: SoundName) {
  if (!useSound.getState().enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    TONES[name].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.09;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    // Browsers may refuse audio entirely; never let a sound break the lesson.
  }
}
