import type { KeyboardEvent, PointerEvent } from "react";

import { cn } from "../lib/utils";

interface ResizeHandleProps {
  ariaLabel: string;
  value: number;
  minimum: number;
  maximum: number;
  direction: 1 | -1;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

export function ResizeHandle({
  ariaLabel,
  value,
  minimum,
  maximum,
  direction,
  onChange,
  onCommit,
}: ResizeHandleProps) {
  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startValue = value;
    let nextValue = startValue;
    const target = event.currentTarget;

    function handlePointerMove(moveEvent: globalThis.PointerEvent): void {
      nextValue = clamp(
        startValue + (moveEvent.clientX - startX) * direction,
        minimum,
        maximum,
      );
      onChange(nextValue);
    }

    function handlePointerUp(): void {
      target.removeEventListener("pointermove", handlePointerMove);
      target.removeEventListener("pointerup", handlePointerUp);
      target.removeEventListener("pointercancel", handlePointerUp);
      onCommit(nextValue);
    }

    target.addEventListener("pointermove", handlePointerMove);
    target.addEventListener("pointerup", handlePointerUp);
    target.addEventListener("pointercancel", handlePointerUp);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const keyboardDirection = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 24 : 8;
    const next = clamp(
      value + keyboardDirection * step * direction,
      minimum,
      maximum,
    );
    onChange(next);
    onCommit(next);
  }

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuemax={maximum}
      aria-valuemin={minimum}
      aria-valuenow={value}
      className={cn(
        "absolute inset-y-0 z-50 w-[5px] touch-none cursor-col-resize outline-none after:absolute after:inset-y-0 after:w-px after:bg-transparent after:content-[''] hover:after:bg-ring focus-visible:after:bg-ring",
        direction === 1
          ? "-right-[3px] after:right-0.5"
          : "-left-[3px] after:left-0.5",
      )}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
