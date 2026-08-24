import { ArrowRight, CaretDown, Check } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { QuestStatus } from "../../shared/tauri/types";
import { i18n } from "../../shared/i18n/i18n";

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
  const { t } = useTranslation("main-window");
  const menuButton = useRef<HTMLButtonElement>(null);
  const action = statusActions(status);

  return (
    <div
      className="status-split"
      title={readOnly ? t("statusControl.readOnly") : undefined}
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
        aria-label={t("statusControl.moreActions")}
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
  const { t } = useTranslation("main-window");
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
      aria-label={t("statusControl.actions")}
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
        primaryLabel: i18n.t("statusControl.moveToReady", {
          ns: "main-window",
        }),
        primaryStatus: "ready",
        secondaryLabel: i18n.t("statusControl.markDone", { ns: "main-window" }),
        secondaryStatus: "done",
      };
    case "ready":
      return {
        primaryLabel: i18n.t("statusControl.markDone", { ns: "main-window" }),
        primaryStatus: "done",
        secondaryLabel: i18n.t("statusControl.moveToInbox", {
          ns: "main-window",
        }),
        secondaryStatus: "inbox",
      };
    case "done":
      return {
        primaryLabel: i18n.t("statusControl.moveToReady", {
          ns: "main-window",
        }),
        primaryStatus: "ready",
        secondaryLabel: i18n.t("statusControl.moveToInbox", {
          ns: "main-window",
        }),
        secondaryStatus: "inbox",
      };
  }
}
