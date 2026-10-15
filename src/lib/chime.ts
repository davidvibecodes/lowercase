"use client";

let ctx: AudioContext | null = null;

/** Short two-note chime for a correct answer (Web Audio, no asset download). */
export function playChime() {
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    [660, 990].forEach((freq, i) => {
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
    // Audio is a nicety; ignore browsers that refuse it.
  }
}
