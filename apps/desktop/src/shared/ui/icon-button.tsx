import type { Icon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: Icon;
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
    <button
      aria-label={label}
      className={`icon-button ${className}`.trim()}
      title={label}
      type="button"
      {...props}
    >
      <IconComponent aria-hidden="true" size={size} weight="regular" />
    </button>
  );
}
