import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: number;
}

export function IconButton({
  icon: IconComponent,
  label,
  size = 16,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      className={cn(className)}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
      {...props}
    >
      <IconComponent aria-hidden="true" size={size} />
    </Button>
  );
}
