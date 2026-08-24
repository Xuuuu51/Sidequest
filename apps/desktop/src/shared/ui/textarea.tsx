import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full resize-none rounded-md border border-input bg-surface px-3 py-2 text-[13px] leading-5 text-surface-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55",
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}

export { Textarea };
