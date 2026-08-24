import {
  FolderOpen,
  LockKeyhole,
  Plus,
  RotateCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useDeferredValue, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSearchQuery, useWorkspaceQuery } from "./data";
import type {
  ProjectDto,
  QuestDto,
  QuestFileIssueDto,
} from "../../shared/tauri/types";
import { showQuickCapture } from "../../shared/tauri/commands";
import { Button } from "../../shared/ui/button";
import { Input } from "../../shared/ui/input";
import { Tooltip } from "../../shared/ui/tooltip";
import { useMainWindowStore } from "../../store/main-window/store";
import { QuestBoard } from "../quests/quest-board";
import { visibleQuestOrder } from "../quests/quest-order";
import { QuestDrawer } from "../quests/quest-drawer";
import { useQuestWriteCoordinator } from "../quests/quest-write-coordinator";
import { localizedError } from "../../shared/i18n/errors";
import { cn } from "../../shared/lib/utils";

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
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const coordinator = useQuestWriteCoordinator();
  const searchQuery = useMainWindowStore((state) => state.searchQuery);
  const selectedQuestId = useMainWindowStore((state) => state.selectedQuestId);
  const drawerOpen = useMainWindowStore((state) => state.drawerOpen);
  const issuesExpanded = useMainWindowStore((state) => state.issuesExpanded);
  const projectMenuPath = useMainWindowStore((state) => state.projectMenuPath);
  const sidebarCollapsed = useMainWindowStore(
    (state) => state.sidebarCollapsed,
  );
  const setSearchQuery = useMainWindowStore((state) => state.setSearchQuery);
  const selectQuest = useMainWindowStore((state) => state.selectQuest);
  const closeDrawer = useMainWindowStore((state) => state.closeDrawer);
  const clearSelection = useMainWindowStore((state) => state.clearSelection);
  const clearEditor = useMainWindowStore((state) => state.clearEditor);
  const editor = useMainWindowStore((state) => state.editor);
  const failSaving = useMainWindowStore((state) => state.failSaving);
  const setExternalConflict = useMainWindowStore(
    (state) => state.setExternalConflict,
  );
  const toggleIssues = useMainWindowStore((state) => state.toggleIssues);
  const setProjectMenuPath = useMainWindowStore(
    (state) => state.setProjectMenuPath,
  );
  const normalizedSearch = searchQuery.trim();
  const deferredSearch = useDeferredValue(normalizedSearch);
  const availablePath = project.state === "unavailable" ? null : project.path;
  const workspace = useWorkspaceQuery(availablePath);
  const search = useSearchQuery(availablePath, deferredSearch);

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
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
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
      toast.info(t("workspace.selectedMissing"));
    }
  }, [
    clearSelection,
    clearEditor,
    editor,
    project.path,
    selectedQuestId,
    setExternalConflict,
    workspace.data,
    workspace.isSuccess,
    t,
  ]);

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

  function restoreListFocus(): void {
    window.setTimeout(() => {
      const questRow =
        selectedQuestId === null
          ? undefined
          : rowRefs.current.get(selectedQuestId);
      (questRow ?? listRef.current)?.focus();
    });
  }

  function handleCloseDrawer(): void {
    void coordinator.guard(() => {
      closeDrawer();
      restoreListFocus();
    });
  }

  const searchActive = normalizedSearch !== "";
  const searchSettling =
    searchActive && (deferredSearch !== normalizedSearch || search.isFetching);
  const visibleQuests = searchActive
    ? (search.data?.quests ?? workspace.data?.quests ?? [])
    : (workspace.data?.quests ?? []);
  const orderedVisibleQuests = visibleQuestOrder(visibleQuests);
  const selectedVisibleIndex = orderedVisibleQuests.findIndex(
    (quest) => quest.id === selectedQuestId,
  );

  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-workspace">
      <header
        className={cn(
          "relative flex h-12 shrink-0 items-center gap-3 border-b border-border/70 bg-workspace pr-4",
          sidebarCollapsed ? "pl-[126px]" : "pl-4",
        )}
        data-tauri-drag-region="deep"
      >
        <h1 className="relative z-10 min-w-0 flex-1 truncate text-sm font-semibold">
          {project.name}
        </h1>
        <label
          className="relative z-10 flex h-8 w-[min(320px,36vw)] items-center gap-2 rounded-md border border-transparent bg-muted px-2 text-muted-foreground transition-shadow focus-within:ring-2 focus-within:ring-ring"
          data-tauri-drag-region="false"
        >
          <Search aria-hidden="true" size={14} />
          <span className="sr-only">{t("toolbar.searchLabel")}</span>
          <Input
            aria-label={t("toolbar.searchLabel")}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 focus-visible:ring-0"
            placeholder={t("toolbar.searchPlaceholder")}
            ref={searchInput}
            value={searchQuery}
          />
          {searchQuery === "" ? (
            <kbd className="text-[10px] text-muted-foreground">
              {t("toolbar.searchShortcut")}
            </kbd>
          ) : (
            <button
              aria-label={t("toolbar.clearSearch")}
              className="rounded-sm border-transparent bg-transparent p-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setSearchQuery("")}
              title={t("toolbar.clearSearch")}
              type="button"
            >
              <X aria-hidden="true" size={13} />
            </button>
          )}
        </label>
        <div className="relative z-10" data-tauri-drag-region="false">
          <Tooltip
            content={t("statusControl.readOnly")}
            disabled={workspace.data?.access !== "readOnly"}
          >
            <Button
              disabled={workspace.data?.access === "readOnly"}
              onClick={() =>
                void showQuickCapture().catch(() =>
                  toast.error(t("toolbar.newQuestFailed")),
                )
              }
              size="sm"
            >
              <Plus aria-hidden="true" size={14} />
              {t("toolbar.newQuest")}
            </Button>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
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
            <div className="relative z-[4] shrink-0">
              {workspace.data.access === "readOnly" && (
                <div
                  className="flex min-h-8.5 items-center gap-2 border-b bg-surface px-3 py-1.5 text-xs text-muted-foreground"
                  role="status"
                >
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
                <div
                  className="flex min-h-8.5 items-center gap-2 border-b bg-surface px-3 py-1.5 text-xs text-warning"
                  role="status"
                >
                  <TriangleAlert aria-hidden="true" size={15} />
                  <span>{t("workspace.externalRefreshFailed")}</span>
                  <Button
                    className="h-auto p-0 text-warning"
                    onClick={() => void workspace.refetch()}
                    variant="ghost"
                  >
                    {t("workspace.reload")}
                  </Button>
                </div>
              )}
            </div>

            {searchActive && search.isError && (
              <div className="flex max-w-[620px] flex-col items-start gap-2 px-6 py-7 text-muted-foreground">
                <strong className="text-sm font-semibold text-foreground">
                  {t("workspace.searchFailed")}
                </strong>
                <span>{localizedError(search.error)}</span>
                <Button
                  onClick={() => void search.refetch()}
                  size="sm"
                  variant="outline"
                >
                  {t("actions.retry", { ns: "common" })}
                </Button>
              </div>
            )}
            <QuestBoard
              drawerOpen={drawerOpen}
              listRef={listRef}
              onNewQuest={() =>
                void showQuickCapture().catch(() =>
                  toast.error(t("toolbar.newQuestFailed")),
                )
              }
              onRegisterRow={(questId, element) => {
                if (element === null) rowRefs.current.delete(questId);
                else rowRefs.current.set(questId, element);
              }}
              onSelectQuest={handleSelectQuest}
              projectPath={project.path}
              quests={visibleQuests}
              searchActive={searchActive}
              searching={searchSettling}
              selectedQuestId={selectedQuestId}
              writable={workspace.data.access === "writable"}
            />
          </>
        )}
      </div>

      {drawerOpen && drawerQuest !== undefined && (
        <QuestDrawer
          access={workspace.data?.access ?? "readOnly"}
          deletedExternally={deletedExternally}
          nextQuest={
            selectedVisibleIndex >= 0
              ? orderedVisibleQuests[selectedVisibleIndex + 1]
              : undefined
          }
          onClose={handleCloseDrawer}
          onNavigate={(questId) =>
            void coordinator.guard(() => selectQuest(questId))
          }
          onPersistPreferences={onPersistPreferences}
          previousQuest={
            selectedVisibleIndex > 0
              ? orderedVisibleQuests[selectedVisibleIndex - 1]
              : undefined
          }
          projectPath={project.path}
          quest={drawerQuest}
        />
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
    <div
      className="flex items-center gap-2 px-4 py-4.5 text-xs text-muted-foreground"
      role="status"
    >
      <span className="size-3.5 animate-spin rounded-full border border-input border-t-muted-foreground" />
      {t("workspace.loading")}
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
    <div className="flex max-w-[620px] flex-col items-start gap-2 px-6 py-7 text-muted-foreground">
      <TriangleAlert aria-hidden="true" size={20} />
      <h2 className="text-sm font-semibold text-foreground">
        {t("workspace.projectUnavailable")}
      </h2>
      <p className="max-w-[560px] select-text [overflow-wrap:anywhere]">
        {t("workspace.cannotAccessProject")}
      </p>
      <div className="mt-1 flex gap-1.5">
        <Button onClick={onLocate} size="sm">
          <FolderOpen aria-hidden="true" size={15} />
          {t("actions.locateFolder", { ns: "common" })}
        </Button>
        <Button onClick={onRetry} size="sm" variant="outline">
          <RotateCw aria-hidden="true" size={15} />
          {t("actions.retry", { ns: "common" })}
        </Button>
        <Button onClick={onReveal} size="sm" variant="outline">
          {t("actions.revealInFinder", { ns: "common" })}
        </Button>
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
    <div className="flex max-w-[620px] flex-col items-start gap-2 px-6 py-7 text-muted-foreground">
      <TriangleAlert aria-hidden="true" size={20} />
      <h2 className="text-sm font-semibold text-foreground">
        {t("workspace.workspaceUnreadable")}
      </h2>
      <p className="max-w-[560px] select-text [overflow-wrap:anywhere]">
        {t("workspace.workspaceUnreadableDescription")}
      </p>
      <div className="mt-1 flex gap-1.5">
        <Button onClick={onRetry} size="sm">
          <RotateCw aria-hidden="true" size={15} />
          {t("actions.retry", { ns: "common" })}
        </Button>
        <Button onClick={onReveal} size="sm" variant="outline">
          {t("actions.revealInFinder", { ns: "common" })}
        </Button>
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
    <div
      className="block border-b bg-surface text-xs text-warning"
      role="status"
    >
      <div className="flex min-h-8.5 items-center gap-2 px-3 py-1.5">
        <TriangleAlert aria-hidden="true" size={15} />
        <span>{t("workspace.issueCount", { count: issues.length })}</span>
        <Button
          aria-expanded={expanded}
          className="h-auto p-0 text-warning"
          onClick={onToggle}
          variant="ghost"
        >
          {expanded ? t("workspace.hideDetails") : t("workspace.viewDetails")}
        </Button>
      </div>
      {expanded && (
        <ul className="max-h-[180px] list-none overflow-y-auto border-t p-0 text-muted-foreground">
          {issues.map((issue) => (
            <li
              className="flex min-h-[42px] items-center justify-between gap-3 border-b px-3 py-1.5"
              key={issue.path}
            >
              <div className="grid min-w-0">
                <span className="truncate">
                  {t("workspace.issueItem", {
                    index: issues.indexOf(issue) + 1,
                  })}
                </span>
              </div>
              <Button
                className="shrink-0"
                onClick={() => onReveal(issue.path)}
                size="sm"
                variant="outline"
              >
                {t("actions.reveal", { ns: "common" })}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LockBannerIcon() {
  return <LockKeyhole aria-hidden="true" size={15} />;
}
