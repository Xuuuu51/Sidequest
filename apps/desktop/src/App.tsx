import { useEffect, useState } from "react";

import {
  useAddProjectMutation,
  useAppStateQuery,
  useRemoveProjectMutation,
  useSelectProjectMutation,
  useWorkspaceQuery,
} from "./features/data/queries";
import { useWorkspaceWatcher } from "./features/data/use-workspace-watcher";
import { selectProjectDirectory } from "./shared/tauri/commands";
import type { ProjectDto } from "./shared/tauri/types";
import { useMainWindowStore } from "./store/main-window";
import "./App.css";

function App() {
  const appState = useAppStateQuery();
  const addProject = useAddProjectMutation();
  const removeProject = useRemoveProjectMutation();
  const selectProjectMutation = useSelectProjectMutation();
  const route = useMainWindowStore((state) => state.route);
  const selectedProjectPath = useMainWindowStore(
    (state) => state.selectedProjectPath,
  );
  const synchronizeAppState = useMainWindowStore(
    (state) => state.synchronizeAppState,
  );
  const selectProject = useMainWindowStore((state) => state.selectProject);
  const workspace = useWorkspaceQuery(selectedProjectPath);
  const watcherError = useWorkspaceWatcher(selectedProjectPath);
  const [actionError, setActionError] = useState<Error | null>(null);

  useEffect(() => {
    if (appState.data !== undefined) {
      synchronizeAppState(appState.data);
    }
  }, [appState.data, synchronizeAppState]);

  async function handleAddProject(): Promise<void> {
    setActionError(null);
    try {
      const projectPath = await selectProjectDirectory();
      if (projectPath === null) {
        return;
      }
      const nextState = await addProject.mutateAsync(projectPath);
      if (nextState.lastSelectedProject !== null) {
        selectProject(nextState.lastSelectedProject);
      }
    } catch (error) {
      setActionError(toError(error));
    }
  }

  async function handleSelectProject(project: ProjectDto): Promise<void> {
    setActionError(null);
    try {
      await selectProjectMutation.mutateAsync(project.path);
      selectProject(project.path);
    } catch (error) {
      setActionError(toError(error));
    }
  }

  async function handleRemoveProject(): Promise<void> {
    if (selectedProjectPath === null) {
      return;
    }
    setActionError(null);
    try {
      await removeProject.mutateAsync(selectedProjectPath);
    } catch (error) {
      setActionError(toError(error));
    }
  }

  if (appState.isPending || route === "restoring") {
    return <main className="validation-page">Restoring Sidequest…</main>;
  }

  if (appState.isError) {
    return (
      <main className="validation-page">
        <h1>Sidequest could not start</h1>
        <p className="error-message">{toError(appState.error).message}</p>
        <button type="button" onClick={() => void appState.refetch()}>
          Retry
        </button>
      </main>
    );
  }

  const state = appState.data;
  if (route === "onboarding") {
    return (
      <main className="validation-page onboarding" aria-label="Sidequest">
        <p className="eyebrow">Sidequest Desktop data foundation</p>
        <h1>Add your first project</h1>
        <p>Selecting a folder initializes its local .sidequest directory.</p>
        <button
          type="button"
          onClick={() => void handleAddProject()}
          disabled={addProject.isPending}
        >
          {addProject.isPending ? "Adding…" : "Add Project"}
        </button>
        {actionError !== null && (
          <p className="error-message">{actionError.message}</p>
        )}
      </main>
    );
  }

  return (
    <main className="validation-shell" aria-label="Sidequest">
      <aside className="project-panel">
        <header>
          <div>
            <p className="eyebrow">Stage 3 validation</p>
            <h1>Projects</h1>
          </div>
          <button
            type="button"
            onClick={() => void handleAddProject()}
            disabled={addProject.isPending}
          >
            Add
          </button>
        </header>
        <nav aria-label="Projects">
          {state.projects.map((project) => (
            <button
              className={
                project.path === selectedProjectPath
                  ? "project-row selected"
                  : "project-row"
              }
              type="button"
              key={project.path}
              onClick={() => void handleSelectProject(project)}
            >
              <span>{project.name}</span>
              <small>{project.state}</small>
            </button>
          ))}
        </nav>
        <button
          className="remove-project"
          type="button"
          onClick={() => void handleRemoveProject()}
          disabled={removeProject.isPending || selectedProjectPath === null}
        >
          {removeProject.isPending ? "Removing…" : "Remove from Sidequest"}
        </button>
      </aside>

      <section className="workspace-panel">
        {state.recoveryWarning !== null && (
          <div className="warning" role="status">
            <strong>Desktop state recovered</strong>
            <span>{state.recoveryWarning.message}</span>
            <code>{state.recoveryWarning.backupPath}</code>
          </div>
        )}
        {actionError !== null && (
          <p className="error-message">{actionError.message}</p>
        )}
        {watcherError !== null && (
          <p className="warning">Watcher: {watcherError.message}</p>
        )}
        {workspace.isPending && <p>Loading workspace…</p>}
        {workspace.isError && (
          <div className="workspace-error">
            <h2>Workspace unavailable</h2>
            <p>{toError(workspace.error).message}</p>
            <button type="button" onClick={() => void workspace.refetch()}>
              Retry
            </button>
          </div>
        )}
        {workspace.isSuccess && (
          <>
            <header className="workspace-heading">
              <div>
                <p className="eyebrow">{workspace.data.access}</p>
                <h2>{selectedProjectPath}</h2>
              </div>
              <button type="button" onClick={() => void workspace.refetch()}>
                Reload
              </button>
            </header>
            {workspace.data.issues.length > 0 && (
              <div className="warning" role="status">
                <strong>{workspace.data.issues.length} unreadable files</strong>
                {workspace.data.issues.map((issue) => (
                  <code key={issue.path}>{issue.path}</code>
                ))}
              </div>
            )}
            <p className="quest-count">
              {workspace.data.quests.length} quest
              {workspace.data.quests.length === 1 ? "" : "s"}
            </p>
            {workspace.data.quests.length === 0 ? (
              <p className="empty-state">
                No quests yet. Add one with the sq CLI to validate file
                watching.
              </p>
            ) : (
              <ul className="quest-list">
                {workspace.data.quests.map((quest) => (
                  <li key={quest.id}>
                    <div>
                      <strong>{quest.status}</strong>
                      <time dateTime={quest.createdAt}>{quest.createdAt}</time>
                    </div>
                    <pre>{quest.content}</pre>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return new Error(value.message);
  }
  return new Error(String(value));
}

export default App;
