import { Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useDeleteQuestMutation,
  useSetQuestStatusMutation,
} from "../data/queries";
import type {
  QuestDto,
  QuestStatus,
  WorkspaceAccess,
} from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { ResizeHandle } from "../../shared/ui/resize-handle";
import { useMainWindowStore } from "../../store/main-window";
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
  onPersistPreferences: () => void;
}

export function QuestDrawer({
  access,
  deletedExternally,
  projectPath,
  quest,
  onClose,
  onPersistPreferences,
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
  const showToast = useMainWindowStore((state) => state.showToast);
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
      showToast(t("drawer.deleted"));
    } catch (error) {
      setDeleteError(localizedError(error));
    }
  }

  function discardDeletedDraft(): void {
    clearEditor();
    clearSelection();
    showToast(t("drawer.externalDeletedClosed"));
  }

  return (
    <>
      <aside
        aria-label={t("drawer.title")}
        className="quest-drawer"
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
        <header className="drawer-header">
          <h2>{t("drawer.title")}</h2>
          <IconButton icon={X} label={t("drawer.close")} onClick={onClose} />
        </header>
        <div className="drawer-body">
          {readOnly ? (
            <div className="drawer-content drawer-content-view" tabIndex={0}>
              {draft}
            </div>
          ) : editor?.phase === "viewing" ? (
            <button
              className="drawer-content drawer-content-view"
              onClick={startEditing}
              title={t("drawer.editContent")}
              type="button"
            >
              {draft}
            </button>
          ) : (
            <textarea
              aria-label={t("drawer.contentLabel")}
              className="drawer-content drawer-content-editor"
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
          <div className="drawer-created-row">
            <time className="drawer-created" dateTime={quest.createdAt}>
              {formatAbsoluteCreatedAt(quest.createdAt)}
            </time>
            <span className="save-status" role="status">
              {editor?.phase === "saving"
                ? t("feedback.saving", { ns: "common" })
                : editor?.savedVisible
                  ? t("feedback.saved", { ns: "common" })
                  : ""}
            </span>
          </div>
        </div>

        <div className="drawer-feedback-stack">
          {editor?.phase === "saveError" && (
            <div className="drawer-inline-error" role="alert">
              <div>
                <strong>{t("drawer.saveFailed")}</strong>
              </div>
              <div className="drawer-error-actions">
                <button
                  onClick={() => void coordinator.retrySave()}
                  type="button"
                >
                  {navigationIntent === "quit"
                    ? t("drawer.retryAndQuit")
                    : t("actions.retry", { ns: "common" })}
                </button>
                <button
                  onClick={() => void coordinator.discardLocalChanges()}
                  type="button"
                >
                  {navigationIntent === "quit"
                    ? t("drawer.quitWithoutSaving")
                    : t("drawer.discardLocalChanges")}
                </button>
                {navigationPending && (
                  <button onClick={coordinator.cancelNavigation} type="button">
                    {t("drawer.cancelNavigation")}
                  </button>
                )}
              </div>
            </div>
          )}
          {editor?.phase === "externalConflict" && (
            <div className="drawer-inline-error conflict" role="alert">
              <div>
                <strong>
                  {editor.conflict === "deleted"
                    ? t("drawer.deletedExternally")
                    : t("drawer.changedExternally")}
                </strong>
                <span>
                  {editor.conflict === "deleted"
                    ? t("drawer.draftPreserved")
                    : t("drawer.chooseContent")}
                </span>
              </div>
              <div className="drawer-error-actions">
                {editor.conflict === "deleted" ? (
                  <button onClick={discardDeletedDraft} type="button">
                    {t("drawer.discardDraft")}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => loadDiskContent(quest.content)}
                      type="button"
                    >
                      {t("drawer.loadDiskVersion")}
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => void coordinator.overwriteConflict()}
                      type="button"
                    >
                      {t("drawer.overwrite")}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {statusError !== null && (
            <div className="drawer-inline-error" role="alert">
              <span>{statusError.message}</span>
              <button
                onClick={() => void changeStatus(statusError.target)}
                type="button"
              >
                {t("actions.retry", { ns: "common" })}
              </button>
              <button onClick={() => setStatusError(null)} type="button">
                {t("actions.dismiss", { ns: "common" })}
              </button>
            </div>
          )}
        </div>

        <footer className="drawer-action-bar">
          <button
            className="delete-action"
            disabled={actionsDisabled}
            onClick={openDeleteConfirmation}
            ref={deleteButtonRef}
            title={
              readOnly ? t("statusControl.readOnly") : t("drawer.deleteQuest")
            }
            type="button"
          >
            <Trash aria-hidden="true" size={16} weight="regular" />
            {t("actions.delete", { ns: "common" })}
          </button>
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
      </aside>

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
    </>
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
