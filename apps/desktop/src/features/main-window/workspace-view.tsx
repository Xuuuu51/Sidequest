import {
  ArrowClockwise,
  FolderOpen,
  LockSimple,
  MagnifyingGlass,
  Sidebar,
  Warning,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useSearchQuery, useWorkspaceQuery } from "../data/queries";
import { useDebouncedValue } from "../../shared/hooks/use-debounced-value";
import type {
  ProjectDto,
  QuestDto,
  QuestFileIssueDto,
} from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { useMainWindowStore } from "../../store/main-window";
import { QuestBoard } from "./quest-board";
import { QuestDrawer } from "./quest-drawer";
import { useQuestWriteCoordinator } from "./quest-write-coordinator";
import { SearchResults } from "./search-results";
import { localizedError } from "../../shared/i18n/errors";

interface WorkspaceViewProps {
  project: ProjectDto;
  watcherError: Error | null;
  onLocate: (project: ProjectDto) => void;
  onPersistPreferences: () => void;
  onReveal: (path: string) => void;
  onRetryAppState: () => void;
}

export function WorkspaceView({
  project,
  watcherError,
  onLocate,
  onPersistPreferences,
  onReveal,
  onRetryAppState,
}: WorkspaceViewProps) {
  const { t } = useTranslation(["main-window", "common"]);
  const searchInput = useRef<HTMLInputElement>(null);
  const coordinator = useQuestWriteCoordinator();
  const searchQuery = useMainWindowStore((state) => state.searchQuery);
  const selectedQuestId = useMainWindowStore((state) => state.selectedQuestId);
  const drawerOpen = useMainWindowStore((state) => state.drawerOpen);
  const issuesExpanded = useMainWindowStore((state) => state.issuesExpanded);
  const toast = useMainWindowStore((state) => state.toast);
  const projectMenuPath = useMainWindowStore((state) => state.projectMenuPath);
  const setSearchQuery = useMainWindowStore((state) => state.setSearchQuery);
  const selectQuest = useMainWindowStore((state) => state.selectQuest);
  const closeDrawer = useMainWindowStore((state) => state.closeDrawer);
  const openSelectedQuest = useMainWindowStore(
    (state) => state.openSelectedQuest,
  );
  const clearSelection = useMainWindowStore((state) => state.clearSelection);
  const clearEditor = useMainWindowStore((state) => state.clearEditor);
  const editor = useMainWindowStore((state) => state.editor);
  const failSaving = useMainWindowStore((state) => state.failSaving);
  const setExternalConflict = useMainWindowStore(
    (state) => state.setExternalConflict,
  );
  const toggleIssues = useMainWindowStore((state) => state.toggleIssues);
  const showToast = useMainWindowStore((state) => state.showToast);
  const setProjectMenuPath = useMainWindowStore(
    (state) => state.setProjectMenuPath,
  );
  const normalizedSearch = searchQuery.trim();
  const debouncedSearch = useDebouncedValue(normalizedSearch, 150);
  const availablePath = project.state === "unavailable" ? null : project.path;
  const workspace = useWorkspaceQuery(availablePath);
  const search = useSearchQuery(availablePath, debouncedSearch);

  useEffect(() => {
    if (project.state === "unavailable") {
      if (
        editor !== null &&
        editor.draftContent !== editor.baseContent &&
        editor.phase !== "saveError"
      ) {
        failSaving(t("workspace.unavailableDraft"));
      } else {
        clearEditor();
        clearSelection();
      }
      setSearchQuery("");
    }
  }, [
    clearEditor,
    clearSelection,
    editor,
    failSaving,
    project.state,
    setSearchQuery,
    t,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.metaKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInput.current?.focus();
        return;
      }
      if (event.key !== "Escape") {
        return;
      }
      if (projectMenuPath !== null) {
        event.preventDefault();
        setProjectMenuPath(null);
      } else if (
        document.activeElement === searchInput.current ||
        searchQuery !== ""
      ) {
        event.preventDefault();
        setSearchQuery("");
        searchInput.current?.blur();
      } else if (drawerOpen) {
        event.preventDefault();
        void coordinator.guard(() => closeDrawer());
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeDrawer,
    drawerOpen,
    projectMenuPath,
    searchQuery,
    setProjectMenuPath,
    setSearchQuery,
    coordinator,
  ]);

  useEffect(() => {
    if (!workspace.isSuccess || selectedQuestId === null) {
      return;
    }
    const selected = findSelectedQuest(workspace.data.quests, selectedQuestId);
    if (selected !== undefined) {
      return;
    }
    const hasDraft =
      editor?.questId === selectedQuestId &&
      editor.projectPath === project.path &&
      editor.draftContent !== editor.baseContent;
    if (hasDraft) {
      if (!(
        editor.phase === "externalConflict" && editor.conflict === "deleted"
      )) {
        setExternalConflict("deleted");
      }
    } else {
      clearEditor();
      clearSelection();
      showToast(t("workspace.selectedMissing"));
    }
  }, [
    clearSelection,
    clearEditor,
    editor,
    project.path,
    selectedQuestId,
    setExternalConflict,
    showToast,
    workspace.data,
    workspace.isSuccess,
    t,
  ]);

  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timeout = setTimeout(() => showToast(null), 2200);
    return () => clearTimeout(timeout);
  }, [showToast, toast]);

  const selectedQuest = workspace.data?.quests.find(
    (quest) => quest.id === selectedQuestId,
  );
  const drawerQuest =
    selectedQuest ??
    (editor !== null &&
    editor.projectPath === project.path &&
    editor.questId === selectedQuestId
      ? {
          id: editor.questId,
          createdAt: editor.createdAt,
          content: editor.baseContent,
          status: editor.status,
        }
      : undefined);
  const deletedExternally =
    selectedQuestId !== null &&
    selectedQuest === undefined &&
    drawerQuest?.id === selectedQuestId;

  function handleSelectQuest(questId: string): void {
    if (questId === selectedQuestId && drawerOpen) {
      return;
    }
    void coordinator.guard(() => selectQuest(questId));
  }

  return (
    <section className="workspace-shell">
      <header className="main-titlebar">
        <div className="titlebar-drag-layer" data-tauri-drag-region />
        <h1>{project.name}</h1>
        <label className="search-field">
          <MagnifyingGlass aria-hidden="true" size={15} weight="regular" />
          <span className="sr-only">{t("toolbar.searchLabel")}</span>
          <input
            aria-label={t("toolbar.searchLabel")}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("toolbar.searchPlaceholder")}
            ref={searchInput}
            value={searchQuery}
          />
          {searchQuery === "" ? (
            <kbd>{t("toolbar.searchShortcut")}</kbd>
          ) : (
            <button
              aria-label={t("toolbar.clearSearch")}
              className="search-clear"
              onClick={() => setSearchQuery("")}
              title={t("toolbar.clearSearch")}
              type="button"
            >
              <X aria-hidden="true" size={13} weight="regular" />
            </button>
          )}
        </label>
        <IconButton
          disabled={selectedQuestId === null || drawerOpen}
          icon={Sidebar}
          label={t("toolbar.openDetails")}
          onClick={openSelectedQuest}
        />
      </header>

      <div className="workspace-content">
        {project.state === "unavailable" ? (
          <UnavailableState
            onLocate={() => onLocate(project)}
            onReveal={() => onReveal(project.path)}
            onRetry={onRetryAppState}
          />
        ) : workspace.isPending ? (
          <LoadingState />
        ) : workspace.isError ? (
          <FatalState
            onReveal={() => onReveal(project.path)}
            onRetry={() => void workspace.refetch()}
          />
        ) : (
          <>
            <div className="workspace-banners">
              {workspace.data.access === "readOnly" && (
                <div className="compact-banner" role="status">
                  <LockBannerIcon />
                  <span>{t("workspace.readOnlyBanner")}</span>
                </div>
              )}
              {workspace.data.issues.length > 0 && (
                <IssuesBanner
                  expanded={issuesExpanded}
                  issues={workspace.data.issues}
                  onReveal={onReveal}
                  onToggle={toggleIssues}
                />
              )}
              {watcherError !== null && (
                <div className="compact-banner warning" role="status">
                  <Warning aria-hidden="true" size={15} weight="regular" />
                  <span>{t("workspace.externalRefreshFailed")}</span>
                  <button
                    className="inline-action"
                    onClick={() => void workspace.refetch()}
                    type="button"
                  >
                    {t("workspace.reload")}
                  </button>
                </div>
              )}
            </div>

            {normalizedSearch === "" ? (
              <QuestBoard
                onSelectQuest={handleSelectQuest}
                projectPath={project.path}
                quests={workspace.data.quests}
                selectedQuestId={selectedQuestId}
                writable={workspace.data.access === "writable"}
              />
            ) : debouncedSearch !== normalizedSearch || search.isPending ? (
              <div className="local-progress" role="status">
                <span className="progress-spinner" /> {t("workspace.searching")}
              </div>
            ) : search.isError ? (
              <div className="inline-error-state">
                <strong>{t("workspace.searchFailed")}</strong>
                <span>{localizedError(search.error)}</span>
                <button onClick={() => void search.refetch()} type="button">
                  {t("actions.retry", { ns: "common" })}
                </button>
              </div>
            ) : (
              <SearchResults
                onClear={() => setSearchQuery("")}
                onSelectQuest={handleSelectQuest}
                query={normalizedSearch}
                quests={search.data.quests}
                selectedQuestId={selectedQuestId}
              />
            )}
          </>
        )}
      </div>

      {drawerOpen && drawerQuest !== undefined && (
        <QuestDrawer
          access={workspace.data?.access ?? "readOnly"}
          deletedExternally={deletedExternally}
          onClose={() => void coordinator.guard(() => closeDrawer())}
          onPersistPreferences={onPersistPreferences}
          projectPath={project.path}
          quest={drawerQuest}
        />
      )}
      {toast !== null && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </section>
  );
}

function findSelectedQuest(
  quests: QuestDto[],
  selectedQuestId: string,
): QuestDto | undefined {
  return quests.find((quest) => quest.id === selectedQuestId);
}

function LoadingState() {
  const { t } = useTranslation("main-window");
  return (
    <div className="local-progress" role="status">
      <span className="progress-spinner" /> {t("workspace.loading")}
    </div>
  );
}

function UnavailableState({
  onLocate,
  onRetry,
  onReveal,
}: {
  onLocate: () => void;
  onRetry: () => void;
  onReveal: () => void;
}) {
  const { t } = useTranslation(["main-window", "common"]);
  return (
    <div className="workspace-state">
      <Warning aria-hidden="true" size={20} weight="regular" />
      <h2>{t("workspace.projectUnavailable")}</h2>
      <p>{t("workspace.cannotAccessProject")}</p>
      <div className="state-actions">
        <button className="primary-button" onClick={onLocate} type="button">
          <FolderOpen aria-hidden="true" size={15} />
          {t("actions.locateFolder", { ns: "common" })}
        </button>
        <button onClick={onRetry} type="button">
          <ArrowClockwise aria-hidden="true" size={15} />
          {t("actions.retry", { ns: "common" })}
        </button>
        <button onClick={onReveal} type="button">
          {t("actions.revealInFinder", { ns: "common" })}
        </button>
      </div>
    </div>
  );
}

function FatalState({
  onRetry,
  onReveal,
}: {
  onRetry: () => void;
  onReveal: () => void;
}) {
  const { t } = useTranslation(["main-window", "common"]);
  return (
    <div className="workspace-state">
      <Warning aria-hidden="true" size={20} weight="regular" />
      <h2>{t("workspace.workspaceUnreadable")}</h2>
      <p>{t("workspace.workspaceUnreadableDescription")}</p>
      <div className="state-actions">
        <button className="primary-button" onClick={onRetry} type="button">
          <ArrowClockwise aria-hidden="true" size={15} />
          {t("actions.retry", { ns: "common" })}
        </button>
        <button onClick={onReveal} type="button">
          {t("actions.revealInFinder", { ns: "common" })}
        </button>
      </div>
    </div>
  );
}

function IssuesBanner({
  issues,
  expanded,
  onToggle,
  onReveal,
}: {
  issues: QuestFileIssueDto[];
  expanded: boolean;
  onToggle: () => void;
  onReveal: (path: string) => void;
}) {
  const { t } = useTranslation(["main-window", "common"]);
  return (
    <div className="issues-banner compact-banner warning" role="status">
      <div className="issues-summary">
        <Warning aria-hidden="true" size={15} weight="regular" />
        <span>{t("workspace.issueCount", { count: issues.length })}</span>
        <button
          aria-expanded={expanded}
          className="inline-action"
          onClick={onToggle}
          type="button"
        >
          {expanded ? t("workspace.hideDetails") : t("workspace.viewDetails")}
        </button>
      </div>
      {expanded && (
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={issue.path}>
              <div>
                <span>
                  {t("workspace.issueItem", {
                    index: issues.indexOf(issue) + 1,
                  })}
                </span>
              </div>
              <button onClick={() => onReveal(issue.path)} type="button">
                {t("actions.reveal", { ns: "common" })}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LockBannerIcon() {
  return <LockSimple aria-hidden="true" size={15} weight="regular" />;
}
