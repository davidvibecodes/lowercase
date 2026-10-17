"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const TONES = ["bg-royal-soft text-royal-bright", "bg-emerald-soft text-emerald", "bg-amber-soft text-amber"];

/** Google photo when there is one, initials otherwise or if the photo fails to load. */
export function Avatar({ first, last, online, size = "md", src }: { first: string; last: string; online?: boolean; size?: "sm" | "md"; src?: string | null }) {
  // Remember which photo failed, not just that one did: the same Avatar can be handed another person's photo.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const tone = TONES[(first.charCodeAt(0) + (last.charCodeAt(0) || 0)) % TONES.length];
  const showPhoto = src && src !== brokenSrc;
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center rounded-full font-extrabold", !showPhoto && tone, size === "md" ? "size-10 text-sm" : "size-8 text-xs")}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small remote avatar; next/image would need remotePatterns for one host
        <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBrokenSrc(src)} className="size-full rounded-full object-cover" />
      ) : (
        <>
          {first[0]}
          {last[0]}
        </>
      )}
      {online !== undefined && (
        <span
          className={cn("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface", online ? "bg-emerald animate-pulse-dot" : "bg-faint")}
        />
      )}
    </span>
  );
}
