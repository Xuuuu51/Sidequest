import { useEffect, useRef } from "react";

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
        <h2 id="delete-title">Delete this Quest?</h2>
        <p className="delete-preview">{content}</p>
        <p id="delete-description">
          This deletes its Markdown file. This can’t be undone in Sidequest.
          {hasUnsavedDraft && " Your recent edits will also be discarded."}
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
            Cancel
          </button>
          <button
            className="danger-button"
            disabled={deleting}
            onClick={onConfirm}
            type="button"
          >
            {deleting ? "Deleting…" : "Delete Quest"}
          </button>
        </div>
      </div>
    </div>
  );
}
