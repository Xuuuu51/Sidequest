import { ArrowRight, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { QuestStatus } from "../../shared/tauri/types";
import { i18n } from "../../shared/i18n/i18n";
import { Button } from "../../shared/ui/button";
import { DropdownMenu as Menu } from "../../shared/ui/dropdown-menu";
import { cn } from "../../shared/lib/utils";

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
  const action = statusActions(status);
  const primaryTone = statusTone(action.primaryStatus);
  const secondaryTone = statusTone(action.secondaryStatus);

  return (
    <div
      className="flex items-center"
      title={readOnly ? t("statusControl.readOnly") : undefined}
    >
      <Button
        className={cn(
          "rounded-r-none border-r border-r-current/20 shadow-none",
          primaryTone.control,
        )}
        disabled={disabled}
        onClick={() => onChangeStatus(action.primaryStatus)}
        variant="outline"
      >
        {loading ? (
          <span className="size-3.5 animate-spin rounded-full border border-current/30 border-t-current" />
        ) : (
          <ArrowRight aria-hidden="true" size={15} />
        )}
        {action.primaryLabel}
      </Button>
      <Menu.Root onOpenChange={onMenuOpenChange} open={menuOpen}>
        <Menu.Trigger
          aria-label={t("statusControl.moreActions")}
          className={cn(
            "inline-flex h-8 w-7 items-center justify-center rounded-r-md border border-l-0 outline-none transition-[background-color,border-color,color,box-shadow] duration-[var(--motion-fast)] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55",
            primaryTone.control,
          )}
          disabled={disabled}
        >
          <ChevronDown aria-hidden="true" size={14} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner
            align="end"
            side="top"
            sideOffset={6}
            className="z-[70] outline-none"
          >
            <Menu.Popup
              aria-label={t("statusControl.actions")}
              className="min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-overlay outline-none"
            >
              <Menu.Item
                className="flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-[13px] outline-none data-[highlighted]:bg-accent"
                onClick={() => onChangeStatus(action.secondaryStatus)}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", secondaryTone.dot)}
                />
                {action.secondaryLabel}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

function statusTone(status: QuestStatus): {
  control: string;
  dot: string;
} {
  switch (status) {
    case "inbox":
      return {
        control:
          "border-status-inbox/35 bg-status-inbox/10 text-foreground hover:bg-status-inbox/16 hover:text-foreground",
        dot: "bg-status-inbox",
      };
    case "ready":
      return {
        control:
          "border-status-ready/35 bg-status-ready/12 text-status-ready hover:bg-status-ready/18 hover:text-status-ready",
        dot: "bg-status-ready",
      };
    case "done":
      return {
        control:
          "border-status-done/35 bg-status-done/12 text-status-done hover:bg-status-done/18 hover:text-status-done",
        dot: "bg-status-done",
      };
  }
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
