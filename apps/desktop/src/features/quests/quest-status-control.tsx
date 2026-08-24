import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { QuestStatus } from "../../shared/tauri/types";
import { i18n } from "../../shared/i18n/i18n";
import { Button } from "../../shared/ui/button";
import { DropdownMenu as Menu } from "../../shared/ui/dropdown-menu";

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

  return (
    <div
      className="flex items-center"
      title={readOnly ? t("statusControl.readOnly") : undefined}
    >
      <Button
        className="rounded-r-none border-r border-primary-foreground/20"
        disabled={disabled}
        onClick={() => onChangeStatus(action.primaryStatus)}
      >
        {loading ? (
          <span className="size-3.5 animate-spin rounded-full border border-primary-foreground/35 border-t-primary-foreground" />
        ) : (
          <ArrowRight aria-hidden="true" size={15} />
        )}
        {action.primaryLabel}
      </Button>
      <Menu.Root onOpenChange={onMenuOpenChange} open={menuOpen}>
        <Menu.Trigger
          aria-label={t("statusControl.moreActions")}
          className="inline-flex h-8 w-7 items-center justify-center rounded-r-md border-transparent bg-primary text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
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
                <Check aria-hidden="true" size={14} /> {action.secondaryLabel}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
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
