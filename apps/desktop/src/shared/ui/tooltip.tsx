import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";

export function Tooltip({
  children,
  content,
  disabled = false,
}: {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}) {
  return (
    <TooltipPrimitive.Root disabled={disabled}>
      <TooltipPrimitive.Trigger
        delay={450}
        render={<span className="inline-flex" tabIndex={0} />}
      >
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="z-[80]" sideOffset={6}>
          <TooltipPrimitive.Popup className="max-w-64 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-overlay">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
