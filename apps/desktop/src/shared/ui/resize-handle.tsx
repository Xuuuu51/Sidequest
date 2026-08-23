import type { KeyboardEvent, PointerEvent } from "react";

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
      className="resize-handle"
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
