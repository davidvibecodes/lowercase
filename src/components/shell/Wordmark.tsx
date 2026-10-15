import { cn } from "@/lib/cn";

/** The lowercase wordmark: a bold lowercase name with an emerald full stop. */
export function Wordmark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("select-none font-extrabold tracking-[-0.04em]", size === "lg" ? "text-4xl" : "text-[26px]", className)}>
      lowercase<span className="text-emerald">.</span>
    </span>
  );
}
