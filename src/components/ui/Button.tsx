import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "success" | "secondary" | "ghost" | "warning";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-royal text-white shadow-[0_4px_0_0_#0f2a7a] hover:bg-[#2459e6] active:translate-y-[3px] active:shadow-none",
  success: "bg-emerald text-obsidian shadow-[0_4px_0_0_#15803d] hover:bg-[#2fd36a] active:translate-y-[3px] active:shadow-none",
  secondary: "bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-surface-3",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-surface-2",
  warning: "bg-amber text-obsidian shadow-[0_4px_0_0_#b45309] hover:bg-[#fbb02a] active:translate-y-[3px] active:shadow-none",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl",
  md: "h-11 px-5 text-[15px] rounded-2xl",
  lg: "h-12 px-6 text-base rounded-2xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-bold transition-[transform,background-color,box-shadow,border-color] duration-100",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    />
  );
});
