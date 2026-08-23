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

import { useSearchQuery, useWorkspaceQuery } from "../data/queries";
import { useDebouncedValue } from "../../shared/hooks/use-debounced-value";
import type { ProjectDto, QuestFileIssueDto } from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { useMainWindowStore } from "../../store/main-window";
import { QuestBoard } from "./quest-board";
import { QuestDrawer } from "./quest-drawer";
import { SearchResults } from "./search-results";

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
  const searchInput = useRef<HTMLInputElement>(null);
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
      clearSelection();
      setSearchQuery("");
    }
  }, [clearSelection, project.state, setSearchQuery]);

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
        closeDrawer();
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
  ]);

  useEffect(() => {
    if (
      workspace.isSuccess &&
      selectedQuestId !== null &&
      !workspace.data.quests.some((quest) => quest.id === selectedQuestId)
    ) {
      clearSelection();
      showToast("The selected Quest no longer exists");
    }
  }, [
    clearSelection,
    selectedQuestId,
    showToast,
    workspace.data,
    workspace.isSuccess,
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

  return (
    <section className="workspace-shell">
      <header className="main-titlebar">
        <div className="titlebar-drag-layer" data-tauri-drag-region />
        <h1>{project.name}</h1>
        <label className="search-field">
          <MagnifyingGlass aria-hidden="true" size={15} weight="regular" />
          <span className="sr-only">Search current project</span>
          <input
            aria-label="Search current project"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search"
            ref={searchInput}
            value={searchQuery}
          />
          {searchQuery === "" ? (
            <kbd>⌘ F</kbd>
          ) : (
            <button
              aria-label="Clear Search"
              className="search-clear"
              onClick={() => setSearchQuery("")}
              title="Clear Search"
              type="button"
            >
              <X aria-hidden="true" size={13} weight="regular" />
            </button>
          )}
        </label>
        <IconButton
          disabled={selectedQuestId === null || drawerOpen}
          icon={Sidebar}
          label="Open Quest details"
          onClick={openSelectedQuest}
        />
      </header>

      <div className="workspace-content">
        {project.state === "unavailable" ? (
          <UnavailableState
            onLocate={() => onLocate(project)}
            onReveal={() => onReveal(project.path)}
            onRetry={onRetryAppState}
            project={project}
          />
        ) : workspace.isPending ? (
          <LoadingState />
        ) : workspace.isError ? (
          <FatalState
            error={toError(workspace.error)}
            onReveal={() => onReveal(project.path)}
            onRetry={() => void workspace.refetch()}
          />
        ) : (
          <>
            <div className="workspace-banners">
              {workspace.data.access === "readOnly" && (
                <div className="compact-banner" role="status">
                  <LockBannerIcon />
                  <span>
                    This project is read-only. Browsing and search remain
                    available.
                  </span>
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
                  <span>External changes may not refresh automatically.</span>
                  <button
                    className="inline-action"
                    onClick={() => void workspace.refetch()}
                    type="button"
                  >
                    Reload
                  </button>
                </div>
              )}
            </div>

            {normalizedSearch === "" ? (
              <QuestBoard
                onSelectQuest={selectQuest}
                projectPath={project.path}
                quests={workspace.data.quests}
                selectedQuestId={selectedQuestId}
              />
            ) : debouncedSearch !== normalizedSearch || search.isPending ? (
              <div className="local-progress" role="status">
                <span className="progress-spinner" /> Searching…
              </div>
            ) : search.isError ? (
              <div className="inline-error-state">
                <strong>Search failed</strong>
                <span>{toError(search.error).message}</span>
                <button onClick={() => void search.refetch()} type="button">
                  Retry
                </button>
              </div>
            ) : (
              <SearchResults
                onClear={() => setSearchQuery("")}
                onSelectQuest={selectQuest}
                query={normalizedSearch}
                quests={search.data.quests}
                selectedQuestId={selectedQuestId}
              />
            )}
          </>
        )}
      </div>

      {drawerOpen && selectedQuest !== undefined && (
        <QuestDrawer
          onClose={closeDrawer}
          onPersistPreferences={onPersistPreferences}
          quest={selectedQuest}
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

function LoadingState() {
  return (
    <div className="local-progress" role="status">
      <span className="progress-spinner" /> Loading workspace…
    </div>
  );
}

function UnavailableState({
  project,
  onLocate,
  onRetry,
  onReveal,
}: {
  project: ProjectDto;
  onLocate: () => void;
  onRetry: () => void;
  onReveal: () => void;
}) {
  return (
    <div className="workspace-state">
      <Warning aria-hidden="true" size={20} weight="regular" />
      <h2>Project unavailable</h2>
      <p>Sidequest can’t access {project.path}.</p>
      <div className="state-actions">
        <button className="primary-button" onClick={onLocate} type="button">
          <FolderOpen aria-hidden="true" size={15} /> Locate Folder
        </button>
        <button onClick={onRetry} type="button">
          <ArrowClockwise aria-hidden="true" size={15} /> Retry
        </button>
        <button onClick={onReveal} type="button">
          Reveal in Finder
        </button>
      </div>
    </div>
  );
}

function FatalState({
  error,
  onRetry,
  onReveal,
}: {
  error: Error;
  onRetry: () => void;
  onReveal: () => void;
}) {
  return (
    <div className="workspace-state">
      <Warning aria-hidden="true" size={20} weight="regular" />
      <h2>Workspace could not be read</h2>
      <p>{error.message}</p>
      <div className="state-actions">
        <button className="primary-button" onClick={onRetry} type="button">
          <ArrowClockwise aria-hidden="true" size={15} /> Retry
        </button>
        <button onClick={onReveal} type="button">
          Reveal in Finder
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
  return (
    <div className="issues-banner compact-banner warning" role="status">
      <div className="issues-summary">
        <Warning aria-hidden="true" size={15} weight="regular" />
        <span>{issues.length} quest files could not be read</span>
        <button
          aria-expanded={expanded}
          className="inline-action"
          onClick={onToggle}
          type="button"
        >
          {expanded ? "Hide Details" : "View Details"}
        </button>
      </div>
      {expanded && (
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={issue.path}>
              <div>
                <code>{issue.path}</code>
                <span>{issue.message}</span>
              </div>
              <button onClick={() => onReveal(issue.path)} type="button">
                Reveal
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

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
