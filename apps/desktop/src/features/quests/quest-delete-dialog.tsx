import { useTranslation } from "react-i18next";

import { Button } from "../../shared/ui/button";
import { AlertDialog } from "../../shared/ui/alert-dialog";

interface QuestDeleteDialogProps {
  content: string;
  deleting: boolean;
  error: string | null;
  hasUnsavedDraft: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function QuestDeleteDialog({
  content,
  deleting,
  error,
  hasUnsavedDraft,
  onCancel,
  onConfirm,
}: QuestDeleteDialogProps) {
  const { t } = useTranslation(["main-window", "common"]);
  return (
    <AlertDialog.Root
      onOpenChange={(open) => {
        if (!open && !deleting) onCancel();
      }}
      open
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-background/70" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[70] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-elevated p-5 text-elevated-foreground shadow-overlay outline-none">
          <AlertDialog.Title className="text-base font-semibold">
            {t("deleteDialog.title")}
          </AlertDialog.Title>
          <p className="mt-3 line-clamp-3 rounded-md bg-muted p-3 text-[13px] text-muted-foreground">
            {content}
          </p>
          <AlertDialog.Description className="mt-3 text-[13px] leading-5 text-muted-foreground">
            {t("deleteDialog.description")}
            {hasUnsavedDraft && ` ${t("deleteDialog.recentDraft")}`}
          </AlertDialog.Description>
          {error !== null && (
            <p className="mt-2.5 text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close
              className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-surface px-3 text-[13px] font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
              disabled={deleting}
            >
              {t("actions.cancel", { ns: "common" })}
            </AlertDialog.Close>
            <Button
              disabled={deleting}
              onClick={onConfirm}
              variant="destructive"
            >
              {deleting
                ? t("deleteDialog.deleting")
                : t("deleteDialog.confirm")}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
