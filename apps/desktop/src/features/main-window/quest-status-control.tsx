import { ArrowRight, CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";

import type { QuestStatus } from "../../shared/tauri/types";

interface QuestStatusControlProps {
  disabled: boolean;
  loading: boolean;
  menuOpen: boolean;
  readOnly: boolean;
  status: QuestStatus;
  onChangeStatus: (status: QuestStatus) => void;
  onMenuOpenChange: (open: boolean) => void;
}

export function QuestStatusControl({
  disabled,
  loading,
  menuOpen,
  readOnly,
  status,
  onChangeStatus,
  onMenuOpenChange,
}: QuestStatusControlProps) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const action = statusActions(status);

  return (
    <div
      className="status-split"
      title={readOnly ? "Project is read-only" : undefined}
    >
      <button
        className="status-primary"
        disabled={disabled}
        onClick={() => onChangeStatus(action.primaryStatus)}
        type="button"
      >
        {loading ? (
          <span className="progress-spinner" />
        ) : (
          <ArrowRight aria-hidden="true" size={15} weight="regular" />
        )}
        {action.primaryLabel}
      </button>
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="More status actions"
        className="status-menu-trigger"
        disabled={disabled}
        onClick={() => onMenuOpenChange(!menuOpen)}
        ref={menuButton}
        type="button"
      >
        <CaretDown aria-hidden="true" size={14} weight="regular" />
      </button>
      {menuOpen && (
        <StatusMenu
          label={action.secondaryLabel}
          onClose={() => {
            onMenuOpenChange(false);
            menuButton.current?.focus();
          }}
          onSelect={() => onChangeStatus(action.secondaryStatus)}
        />
      )}
    </div>
  );
}

function StatusMenu({
  label,
  onClose,
  onSelect,
}: {
  label: string;
  onClose: () => void;
  onSelect: () => void;
}) {
  const item = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    item.current?.focus();
    function closeOnPointer(event: PointerEvent): void {
      if (
        !(event.target instanceof Node) ||
        !item.current?.parentElement?.contains(event.target)
      ) {
        onClose();
      }
    }
    window.addEventListener("pointerdown", closeOnPointer);
    return () => window.removeEventListener("pointerdown", closeOnPointer);
  }, [onClose]);

  return (
    <div
      aria-label="Status actions"
      className="status-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          item.current?.focus();
        }
      }}
      role="menu"
    >
      <button onClick={onSelect} ref={item} role="menuitem" type="button">
        <Check aria-hidden="true" size={14} weight="regular" /> {label}
      </button>
    </div>
  );
}

function statusActions(status: QuestStatus): {
  primaryLabel: string;
  primaryStatus: QuestStatus;
  secondaryLabel: string;
  secondaryStatus: QuestStatus;
} {
  switch (status) {
    case "inbox":
      return {
        primaryLabel: "Move to Ready",
        primaryStatus: "ready",
        secondaryLabel: "Mark Done",
        secondaryStatus: "done",
      };
    case "ready":
      return {
        primaryLabel: "Mark Done",
        primaryStatus: "done",
        secondaryLabel: "Move to Inbox",
        secondaryStatus: "inbox",
      };
    case "done":
      return {
        primaryLabel: "Move to Ready",
        primaryStatus: "ready",
        secondaryLabel: "Move to Inbox",
        secondaryStatus: "inbox",
      };
  }
}
