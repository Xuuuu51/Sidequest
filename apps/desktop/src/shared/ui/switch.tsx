import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils";

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-5 w-[34px] shrink-0 cursor-default rounded-full border border-input bg-elevated outline-none transition-colors data-[checked]:border-ring data-[checked]:bg-ring/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-3.5 translate-x-[3px] rounded-full bg-muted-foreground transition-[transform,background-color] data-[checked]:translate-x-4 data-[checked]:bg-foreground motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
