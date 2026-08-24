import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useDeleteQuestMutation, useSetQuestStatusMutation } from "./data";
import type {
  QuestDto,
  QuestStatus,
  WorkspaceAccess,
} from "../../shared/tauri/types";
import { Button } from "../../shared/ui/button";
import { Sheet as Dialog } from "../../shared/ui/sheet";
import { Textarea } from "../../shared/ui/textarea";
import { ResizeHandle } from "../../shared/ui/resize-handle";
import { useMainWindowStore } from "../../store/main-window/store";
import { QuestDeleteDialog } from "./quest-delete-dialog";
import { QuestStatusControl } from "./quest-status-control";
import { useQuestWriteCoordinator } from "./quest-write-coordinator";
import { localizedError } from "../../shared/i18n/errors";
import { i18n } from "../../shared/i18n/i18n";

interface QuestDrawerProps {
  access: WorkspaceAccess;
  deletedExternally: boolean;
  projectPath: string;
  quest: QuestDto;
  onClose: () => void;
  onNavigate: (questId: string) => void;
  onPersistPreferences: () => void;
  previousQuest?: QuestDto;
  nextQuest?: QuestDto;
}

export function QuestDrawer({
  access,
  deletedExternally,
  projectPath,
  quest,
  onClose,
  onNavigate,
  onPersistPreferences,
  previousQuest,
  nextQuest,
}: QuestDrawerProps) {
  const { t } = useTranslation(["main-window", "common"]);
  const drawerWidth = useMainWindowStore((state) => state.drawerWidth);
  const editor = useMainWindowStore((state) => state.editor);
  const statusMenuOpen = useMainWindowStore((state) => state.statusMenuOpen);
  const deleteConfirming = useMainWindowStore(
    (state) => state.deleteConfirming,
  );
  const deleteError = useMainWindowStore((state) => state.deleteError);
  const navigationPending = useMainWindowStore(
    (state) => state.navigationPending,
  );
  const navigationIntent = useMainWindowStore(
    (state) => state.navigationIntent,
  );
  const setDrawerWidth = useMainWindowStore((state) => state.setDrawerWidth);
  const initializeEditor = useMainWindowStore(
    (state) => state.initializeEditor,
  );
  const startEditing = useMainWindowStore((state) => state.startEditing);
  const setEditorStatus = useMainWindowStore((state) => state.setEditorStatus);
  const stopEditing = useMainWindowStore((state) => state.stopEditing);
  const changeDraft = useMainWindowStore((state) => state.changeDraft);
  const setExternalConflict = useMainWindowStore(
    (state) => state.setExternalConflict,
  );
  const loadDiskContent = useMainWindowStore((state) => state.loadDiskContent);
  const clearEditor = useMainWindowStore((state) => state.clearEditor);
  const clearSelection = useMainWindowStore((state) => state.clearSelection);
  const setStatusMenuOpen = useMainWindowStore(
    (state) => state.setStatusMenuOpen,
  );
  const setDeleteConfirming = useMainWindowStore(
    (state) => state.setDeleteConfirming,
  );
  const setDeleteError = useMainWindowStore((state) => state.setDeleteError);
  const coordinator = useQuestWriteCoordinator();
  const statusMutation = useSetQuestStatusMutation(projectPath, quest.id);
  const deleteMutation = useDeleteQuestMutation(projectPath, quest.id);
  const [statusError, setStatusError] = useState<{
    message: string;
    target: QuestStatus;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const readOnly = access === "readOnly";

  useEffect(() => {
    if (
      editor === null ||
      editor.projectPath !== projectPath ||
      editor.questId !== quest.id
    ) {
      initializeEditor(
        projectPath,
        quest.id,
        quest.content,
        quest.createdAt,
        quest.status,
      );
      return;
    }
    if (editor.status !== quest.status) {
      setEditorStatus(quest.status);
    }
    if (deletedExternally) {
      if (
        editor.draftContent !== editor.baseContent &&
        !(editor.phase === "externalConflict" && editor.conflict === "deleted")
      ) {
        setExternalConflict("deleted");
      }
      return;
    }
    if (editor.phase === "externalConflict") {
      return;
    }
    if (
      quest.content === editor.baseContent ||
      quest.content === editor.draftContent
    ) {
      return;
    }
    if (editor.draftContent === editor.baseContent) {
      loadDiskContent(quest.content);
    } else if (editor.phase !== "saving") {
      setExternalConflict("modified");
    }
  }, [
    deletedExternally,
    editor,
    initializeEditor,
    loadDiskContent,
    projectPath,
    quest.content,
    quest.createdAt,
    quest.id,
    quest.status,
    setExternalConflict,
    setEditorStatus,
  ]);

  useEffect(() => {
    if (
      editor?.phase === "editing" ||
      editor?.phase === "pending" ||
      editor?.phase === "saveError"
    ) {
      textareaRef.current?.focus();
    }
  }, [editor?.phase]);

  const draft = editor?.draftContent ?? quest.content;
  const conflict = editor?.phase === "externalConflict";
  const writing =
    editor?.phase === "saving" ||
    statusMutation.isPending ||
    deleteMutation.isPending;
  const actionsDisabled = readOnly || conflict || writing || deletedExternally;

  async function changeStatus(status: QuestStatus): Promise<void> {
    setStatusMenuOpen(false);
    setStatusError(null);
    await coordinator.guard(async () => {
      try {
        await statusMutation.mutateAsync(status);
      } catch (error) {
        setStatusError({ message: localizedError(error), target: status });
      }
    });
  }

  function openDeleteConfirmation(): void {
    setStatusMenuOpen(false);
    setDeleteConfirming(true);
  }

  async function confirmDelete(): Promise<void> {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync();
      setDeleteConfirming(false);
      clearEditor();
      clearSelection();
      toast.success(t("drawer.deleted"));
    } catch (error) {
      setDeleteError(localizedError(error));
    }
  }

  function discardDeletedDraft(): void {
    clearEditor();
    clearSelection();
    toast.info(t("drawer.externalDeletedClosed"));
  }

  return (
    <Dialog.Root
      modal
      onOpenChange={(open) => {
        if (!open && !statusMenuOpen && !deleteConfirming) onClose();
      }}
      open
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-background/55 backdrop-blur-[1px] transition-opacity" />
        <Dialog.Popup
          aria-label={t("drawer.title")}
          className="fixed inset-y-0 right-0 z-50 flex min-w-[420px] max-w-[560px] flex-col overflow-hidden rounded-l-xl border-l bg-elevated shadow-[var(--shadow-drawer)] outline-none"
          style={{ width: drawerWidth }}
        >
          <ResizeHandle
            ariaLabel={t("drawer.resize")}
            direction={-1}
            maximum={560}
            minimum={420}
            onChange={setDrawerWidth}
            onCommit={onPersistPreferences}
            value={drawerWidth}
          />
          <header className="flex h-11 shrink-0 items-center justify-between border-b py-0 pl-4 pr-2.5">
            <Dialog.Title className="text-sm font-semibold">
              {t("drawer.title")}
            </Dialog.Title>
            <div className="ml-auto flex items-center gap-1">
              <Button
                aria-label={t("drawer.previous")}
                disabled={previousQuest === undefined || navigationPending}
                onClick={() => previousQuest && onNavigate(previousQuest.id)}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft aria-hidden="true" size={16} />
              </Button>
              <Button
                aria-label={t("drawer.next")}
                disabled={nextQuest === undefined || navigationPending}
                onClick={() => nextQuest && onNavigate(nextQuest.id)}
                size="icon"
                variant="ghost"
              >
                <ChevronRight aria-hidden="true" size={16} />
              </Button>
              <Dialog.Close
                aria-label={t("drawer.close")}
                className="inline-flex size-7 items-center justify-center rounded-md border-transparent bg-transparent text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden="true" size={16} />
              </Dialog.Close>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[22px] pb-4 pt-[18px]">
            {readOnly ? (
              <div
                className="block min-h-[200px] w-full flex-1 select-text whitespace-pre-wrap rounded-sm bg-transparent p-0 text-left text-sm leading-[22px] text-foreground outline-none [overflow-wrap:anywhere]"
                tabIndex={0}
              >
                {draft}
              </div>
            ) : editor?.phase === "viewing" ? (
              <button
                className="block min-h-[200px] w-full flex-1 select-text whitespace-pre-wrap rounded-sm border-0 bg-transparent p-0 text-left text-sm leading-[22px] text-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring [overflow-wrap:anywhere]"
                onClick={startEditing}
                title={t("drawer.editContent")}
                type="button"
              >
                {draft}
              </button>
            ) : (
              <Textarea
                aria-label={t("drawer.contentLabel")}
                className="block min-h-[200px] w-full flex-1 resize-none select-text whitespace-pre-wrap rounded-sm border-0 bg-transparent p-0 text-left text-sm leading-[22px] text-foreground shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring [overflow-wrap:anywhere]"
                onBlur={stopEditing}
                onChange={(event) => changeDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.metaKey && event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    void coordinator.flush();
                  }
                }}
                readOnly={conflict}
                ref={textareaRef}
                value={draft}
              />
            )}
            <div className="flex min-h-9 items-end justify-between gap-4 pt-3.5">
              <time
                className="text-xs text-muted-foreground"
                dateTime={quest.createdAt}
              >
                {formatAbsoluteCreatedAt(quest.createdAt)}
              </time>
              <span
                className="min-w-[54px] text-right text-xs text-muted-foreground"
                role="status"
              >
                {editor?.phase === "saving"
                  ? t("feedback.saving", { ns: "common" })
                  : editor?.savedVisible
                    ? t("feedback.saved", { ns: "common" })
                    : ""}
              </span>
            </div>
          </div>

          <div className="shrink-0">
            {editor?.phase === "saveError" && (
              <div
                className="flex min-h-11 items-center justify-between gap-3 border-t border-destructive/40 bg-destructive/7 px-3.5 py-2 text-xs text-destructive"
                role="alert"
              >
                <div className="grid min-w-0">
                  <strong className="font-semibold text-foreground">
                    {t("drawer.saveFailed")}
                  </strong>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Button
                    onClick={() => void coordinator.retrySave()}
                    size="sm"
                    variant="outline"
                  >
                    {navigationIntent === "quit"
                      ? t("drawer.retryAndQuit")
                      : t("actions.retry", { ns: "common" })}
                  </Button>
                  <Button
                    onClick={() => void coordinator.discardLocalChanges()}
                    size="sm"
                    variant="outline"
                  >
                    {navigationIntent === "quit"
                      ? t("drawer.quitWithoutSaving")
                      : t("drawer.discardLocalChanges")}
                  </Button>
                  {navigationPending && (
                    <Button
                      onClick={coordinator.cancelNavigation}
                      size="sm"
                      variant="outline"
                    >
                      {t("drawer.cancelNavigation")}
                    </Button>
                  )}
                </div>
              </div>
            )}
            {editor?.phase === "externalConflict" && (
              <div
                className="flex min-h-11 items-center justify-between gap-3 border-t border-warning/40 bg-warning/7 px-3.5 py-2 text-xs text-warning"
                role="alert"
              >
                <div className="grid min-w-0">
                  <strong className="font-semibold text-foreground">
                    {editor.conflict === "deleted"
                      ? t("drawer.deletedExternally")
                      : t("drawer.changedExternally")}
                  </strong>
                  <span className="truncate">
                    {editor.conflict === "deleted"
                      ? t("drawer.draftPreserved")
                      : t("drawer.chooseContent")}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {editor.conflict === "deleted" ? (
                    <Button
                      onClick={discardDeletedDraft}
                      size="sm"
                      variant="outline"
                    >
                      {t("drawer.discardDraft")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => loadDiskContent(quest.content)}
                        size="sm"
                        variant="outline"
                      >
                        {t("drawer.loadDiskVersion")}
                      </Button>
                      <Button
                        onClick={() => void coordinator.overwriteConflict()}
                        size="sm"
                      >
                        {t("drawer.overwrite")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
            {statusError !== null && (
              <div
                className="flex min-h-11 items-center justify-between gap-3 border-t border-destructive/40 bg-destructive/7 px-3.5 py-2 text-xs text-destructive"
                role="alert"
              >
                <span className="truncate">{statusError.message}</span>
                <Button
                  onClick={() => void changeStatus(statusError.target)}
                  size="sm"
                  variant="outline"
                >
                  {t("actions.retry", { ns: "common" })}
                </Button>
                <Button
                  onClick={() => setStatusError(null)}
                  size="sm"
                  variant="ghost"
                >
                  {t("actions.dismiss", { ns: "common" })}
                </Button>
              </div>
            )}
          </div>

          <footer className="flex h-16 shrink-0 items-center justify-between border-t bg-surface px-3.5">
            <Button
              className="text-destructive hover:text-destructive"
              disabled={actionsDisabled}
              onClick={openDeleteConfirmation}
              ref={deleteButtonRef}
              title={
                readOnly ? t("statusControl.readOnly") : t("drawer.deleteQuest")
              }
              variant="ghost"
            >
              <Trash2 aria-hidden="true" size={16} />
              {t("actions.delete", { ns: "common" })}
            </Button>
            <QuestStatusControl
              disabled={actionsDisabled}
              loading={writing}
              menuOpen={statusMenuOpen}
              onChangeStatus={(status) => void changeStatus(status)}
              onMenuOpenChange={setStatusMenuOpen}
              readOnly={readOnly}
              status={quest.status}
            />
          </footer>
        </Dialog.Popup>

        {deleteConfirming && (
          <QuestDeleteDialog
            content={draft}
            deleting={deleteMutation.isPending}
            error={deleteError}
            hasUnsavedDraft={editor?.draftContent !== editor?.baseContent}
            onCancel={() => {
              setDeleteConfirming(false);
              deleteButtonRef.current?.focus();
            }}
            onConfirm={() => void confirmDelete()}
          />
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function formatAbsoluteCreatedAt(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return i18n.t("time.unknown", { ns: "common" });
  }
  return i18n.t("time.created", {
    ns: "common",
    value: new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(created),
  });
}
