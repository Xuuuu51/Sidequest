import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

const modifierGlyphs = /[⌘⌃⌥⇧]|[^⌘⌃⌥⇧\s]+/g;

interface ShortcutHintProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  "aria-hidden" | "children"
> {
  shortcut: string;
  tone?: "neutral" | "brand";
  density?: "default" | "compact";
  divided?: boolean;
}

export function ShortcutHint({
  shortcut,
  tone = "neutral",
  density = "default",
  divided = false,
  className,
  ...props
}: ShortcutHintProps) {
  const keys = shortcut.match(modifierGlyphs) ?? [];

  if (keys.length === 0) return null;

  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center",
        density === "compact" ? "gap-0.5 opacity-70" : "gap-1",
        divided &&
          (tone === "brand"
            ? "border-l border-brand-foreground/20 pl-2"
            : "border-l border-border pl-2"),
        className,
      )}
    >
      {keys.map((key, index) => (
        <kbd
          className={cn(
            "inline-flex items-center justify-center font-medium leading-none shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-inset",
            density === "compact"
              ? "h-4 min-w-4 rounded-[3px] px-0.5 text-[8px]"
              : "h-[18px] min-w-[18px] rounded-[4px] px-1 text-[9px]",
            tone === "brand"
              ? "bg-brand-foreground/10 text-brand-foreground/80 ring-brand-foreground/15"
              : "bg-surface/70 text-muted-foreground ring-border/80",
          )}
          key={`${key}-${index}`}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}
