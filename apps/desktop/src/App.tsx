import { Warning, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
  useAddProjectMutation,
  useAppStateQuery,
  usePanelPreferencesMutation,
  useRelocateProjectMutation,
  useRemoveProjectMutation,
  useSelectProjectMutation,
} from "./features/data/queries";
import { useWorkspaceWatcher } from "./features/data/use-workspace-watcher";
import { useAppStateInvalidation } from "./features/data/use-app-state-invalidation";
import { useSettingsInvalidation } from "./features/data/use-settings-invalidation";
import { OnboardingFlow } from "./features/onboarding/onboarding-flow";
import { ProjectSidebar } from "./features/main-window/project-sidebar";
import {
  QuestWriteCoordinatorProvider,
  useQuestWriteCoordinator,
} from "./features/main-window/quest-write-coordinator";
import { WorkspaceView } from "./features/main-window/workspace-view";
import { SettingsPage } from "./features/settings/settings-page";
import { useWindowGeometryPersistence } from "./features/window/use-window-geometry";
import {
  revealPath,
  selectProjectDirectory,
  selectReplacementDirectory,
} from "./shared/tauri/commands";
import type { ProjectDto } from "./shared/tauri/types";
import { listenForOpenSettings } from "./shared/tauri/events";
import { IconButton } from "./shared/ui/icon-button";
import {
  currentPanelPreferences,
  useMainWindowStore,
} from "./store/main-window";
import "./App.css";

function App() {
  return (
    <QuestWriteCoordinatorProvider>
      <AppContent />
    </QuestWriteCoordinatorProvider>
  );
}

function AppContent() {
  useAppStateInvalidation();
  useSettingsInvalidation();
  const coordinator = useQuestWriteCoordinator();
  useWindowGeometryPersistence(coordinator.guard);
  const appState = useAppStateQuery();
  const addProject = useAddProjectMutation();
  const removeProject = useRemoveProjectMutation();
  const relocateProject = useRelocateProjectMutation();
  const selectProjectMutation = useSelectProjectMutation();
  const panelPreferences = usePanelPreferencesMutation();
  const route = useMainWindowStore((state) => state.route);
  const selectedProjectPath = useMainWindowStore(
    (state) => state.selectedProjectPath,
  );
  const recoveryDismissed = useMainWindowStore(
    (state) => state.recoveryDismissed,
  );
  const synchronizeAppState = useMainWindowStore(
    (state) => state.synchronizeAppState,
  );
  const selectProject = useMainWindowStore((state) => state.selectProject);
  const dismissRecovery = useMainWindowStore((state) => state.dismissRecovery);
  const setProjectMenuPath = useMainWindowStore(
    (state) => state.setProjectMenuPath,
  );
  const openSettings = useMainWindowStore((state) => state.openSettings);
  const closeSettings = useMainWindowStore((state) => state.closeSettings);
  const [actionError, setActionError] = useState<Error | null>(null);

  useEffect(() => {
    if (appState.data !== undefined) {
      synchronizeAppState(appState.data);
    }
  }, [appState.data, synchronizeAppState]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForOpenSettings(() => {
      void coordinator.guard(async () => openSettings());
    }).then((listener) => {
      if (active) unlisten = listener;
      else listener();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [coordinator, openSettings]);

  const selectedProject = appState.data?.projects.find(
    (project) => project.path === selectedProjectPath,
  );
  const watchedPath =
    selectedProject?.state === "unavailable"
      ? null
      : (selectedProject?.path ?? null);
  const watcherError = useWorkspaceWatcher(watchedPath);

  async function handleAddProject(): Promise<void> {
    setActionError(null);
    try {
      const projectPath = await selectProjectDirectory();
      if (projectPath === null) {
        return;
      }
      await coordinator.guard(async () => {
        const nextState = await addProject.mutateAsync(projectPath);
        if (nextState.lastSelectedProject !== null) {
          selectProject(nextState.lastSelectedProject);
        }
      });
    } catch (error) {
      setActionError(toError(error));
    }
  }

  async function handleSelectProject(project: ProjectDto): Promise<void> {
    if (project.path === selectedProjectPath) {
      return;
    }
    setActionError(null);
    try {
      await coordinator.guard(async () => {
        await selectProjectMutation.mutateAsync(project.path);
        selectProject(project.path);
      });
    } catch (error) {
      setActionError(toError(error));
    }
  }

  async function handleRemoveProject(project: ProjectDto): Promise<void> {
    setActionError(null);
    try {
      const remove = async () => {
        const nextState = await removeProject.mutateAsync(project.path);
        synchronizeAppState(nextState);
      };
      if (project.path === selectedProjectPath) {
        await coordinator.guard(remove);
      } else {
        await remove();
      }
    } catch (error) {
      setActionError(toError(error));
    }
  }

  async function handleLocateProject(project: ProjectDto): Promise<void> {
    setActionError(null);
    try {
      const replacementPath = await selectReplacementDirectory();
      if (replacementPath === null) {
        return;
      }
      const nextState = await relocateProject.mutateAsync({
        projectPath: project.path,
        replacementPath,
      });
      synchronizeAppState(nextState);
      if (nextState.lastSelectedProject !== null) {
        selectProject(nextState.lastSelectedProject);
      }
    } catch (error) {
      setActionError(toError(error));
    }
  }

  async function handleReveal(path: string): Promise<void> {
    setActionError(null);
    try {
      await revealPath(path);
    } catch (error) {
      setActionError(toError(error));
    }
  }

  function persistPanelPreferences(): void {
    const preferences = currentPanelPreferences(useMainWindowStore.getState());
    panelPreferences.mutate(preferences, {
      onError: (error) => setActionError(toError(error)),
    });
  }

  async function handleOpenSettings(): Promise<void> {
    setActionError(null);
    try {
      await coordinator.guard(async () => openSettings());
    } catch (error) {
      setActionError(toError(error));
    }
  }

  if (appState.isPending || route === "restoring") {
    return (
      <main className="startup-state">
        <div className="standalone-drag-region" data-tauri-drag-region />
        <span className="progress-spinner" /> Restoring Sidequest…
      </main>
    );
  }

  if (appState.isError) {
    return (
      <main className="startup-state startup-error">
        <div className="standalone-drag-region" data-tauri-drag-region />
        <Warning aria-hidden="true" size={22} weight="regular" />
        <h1>Sidequest could not start</h1>
        <p>{toError(appState.error).message}</p>
        <button onClick={() => void appState.refetch()} type="button">
          Retry
        </button>
      </main>
    );
  }

  if (route === "onboarding") {
    return (
      <OnboardingFlow
        appState={appState.data}
        addPending={addProject.isPending}
        error={actionError?.message ?? null}
        onAddProject={() => void handleAddProject()}
      />
    );
  }

  const state = appState.data;
  return (
    <main
      className="application-shell"
      onPointerDown={() => setProjectMenuPath(null)}
    >
      <ProjectSidebar
        addPending={addProject.isPending}
        onAdd={() => void handleAddProject()}
        onLocate={(project) => void handleLocateProject(project)}
        onPersistPreferences={persistPanelPreferences}
        onSettings={() => void handleOpenSettings()}
        onRemove={(project) => void handleRemoveProject(project)}
        onReveal={(path) => void handleReveal(path)}
        onSelect={(project) => void handleSelectProject(project)}
        projects={state.projects}
        selectedProjectPath={selectedProjectPath}
        settingsSelected={route === "settings"}
      />
      {route === "settings" ? (
        <SettingsPage onBack={() => closeSettings(state.projects.length > 0)} />
      ) : (
        selectedProject !== undefined && (
          <WorkspaceView
            onLocate={(project) => void handleLocateProject(project)}
            onPersistPreferences={persistPanelPreferences}
            onRetryAppState={() => void appState.refetch()}
            onReveal={(path) => void handleReveal(path)}
            project={selectedProject}
            watcherError={watcherError}
          />
        )
      )}
      {state.recoveryWarning !== null && !recoveryDismissed && (
        <div className="recovery-banner" role="status">
          <Warning aria-hidden="true" size={15} weight="regular" />
          <div>
            <strong>Desktop state recovered</strong>
            <span>{state.recoveryWarning.message}</span>
            <code>{state.recoveryWarning.backupPath}</code>
          </div>
          <IconButton
            icon={X}
            label="Dismiss recovery warning"
            onClick={dismissRecovery}
          />
        </div>
      )}
      {actionError !== null && (
        <div className="action-error" role="alert">
          <Warning aria-hidden="true" size={15} weight="regular" />
          <span>{actionError.message}</span>
          <IconButton
            icon={X}
            label="Dismiss error"
            onClick={() => setActionError(null)}
          />
        </div>
      )}
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
