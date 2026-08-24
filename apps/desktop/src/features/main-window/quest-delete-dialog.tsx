import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

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
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancel.current?.focus();
  }, []);

  return (
    <div className="dialog-scrim">
      <div
        aria-describedby="delete-description"
        aria-labelledby="delete-title"
        className="delete-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !deleting) {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
          if (event.key !== "Tab" || dialog.current === null) {
            return;
          }
          const controls = Array.from(
            dialog.current.querySelectorAll<HTMLElement>(
              "button:not([disabled])",
            ),
          );
          if (controls.length === 0) {
            return;
          }
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        ref={dialog}
        role="alertdialog"
      >
        <h2 id="delete-title">{t("deleteDialog.title")}</h2>
        <p className="delete-preview">{content}</p>
        <p id="delete-description">
          {t("deleteDialog.description")}
          {hasUnsavedDraft && ` ${t("deleteDialog.recentDraft")}`}
        </p>
        {error !== null && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            disabled={deleting}
            onClick={onCancel}
            ref={cancel}
            type="button"
          >
            {t("actions.cancel", { ns: "common" })}
          </button>
          <button
            className="danger-button"
            disabled={deleting}
            onClick={onConfirm}
            type="button"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
