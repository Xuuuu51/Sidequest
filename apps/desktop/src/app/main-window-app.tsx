import { TriangleAlert, X } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAppStateQuery } from "../features/app-state/data";
import { ProjectSidebar } from "../features/projects/project-sidebar";
import {
  QuestWriteCoordinatorProvider,
  useQuestWriteCoordinator,
} from "../features/quests/quest-write-coordinator";
import { WorkspaceView } from "../features/workspace/workspace-view";
import { useProjectActions } from "../features/projects/project-actions";
import { useWorkspaceWatcher } from "../features/workspace/data";
import { localizedError } from "../shared/i18n/errors";
import { Button } from "../shared/ui/button";
import { useMainWindowStore } from "../store/main-window/store";
import { currentProjectPath } from "../store/main-window/types";
import { useMainWindowRuntime } from "./main-window-runtime";

const OnboardingFlow = lazy(() =>
  import("../features/onboarding/onboarding-flow").then((module) => ({
    default: module.OnboardingFlow,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/settings-page").then((module) => ({
    default: module.SettingsPage,
  })),
);

export function MainWindowApp() {
  return (
    <QuestWriteCoordinatorProvider>
      <MainWindowContent />
    </QuestWriteCoordinatorProvider>
  );
}

function MainWindowContent() {
  const { t } = useTranslation(["main-window", "common"]);
  useMainWindowRuntime();
  const coordinator = useQuestWriteCoordinator();
  const appState = useAppStateQuery();
  const projectActions = useProjectActions();
  const view = useMainWindowStore((state) => state.view);
  const recoveryDismissed = useMainWindowStore(
    (state) => state.recoveryDismissed,
  );
  const restoreAppState = useMainWindowStore((state) => state.restoreAppState);
  const dismissRecovery = useMainWindowStore((state) => state.dismissRecovery);
  const showSettings = useMainWindowStore((state) => state.showSettings);
  const closeSettings = useMainWindowStore((state) => state.closeSettings);
  const selectedProjectPath = currentProjectPath(view);

  useEffect(() => {
    if (appState.data !== undefined) restoreAppState(appState.data);
  }, [appState.data, restoreAppState]);

  const selectedProject = appState.data?.projects.find(
    (project) => project.path === selectedProjectPath,
  );
  const watchedPath =
    selectedProject?.state === "unavailable"
      ? null
      : (selectedProject?.path ?? null);
  const watcherError = useWorkspaceWatcher(watchedPath);

  if (appState.isPending || view.name === "restoring") {
    return <WindowPending label={t("shell.restoring")} />;
  }

  if (appState.isError) {
    return (
      <main className="relative flex h-full w-full flex-col items-center justify-center gap-2 bg-background text-muted-foreground">
        <WindowDragRegion />
        <TriangleAlert aria-hidden="true" size={22} />
        <h1 className="mt-1 text-base font-semibold text-foreground">
          {t("shell.startFailed")}
        </h1>
        <p className="max-w-lg text-center text-sm">
          {localizedError(appState.error)}
        </p>
        <Button onClick={() => void appState.refetch()}>
          {t("actions.retry", { ns: "common" })}
        </Button>
      </main>
    );
  }

  if (view.name === "onboarding") {
    return (
      <Suspense fallback={<WindowPending label={t("shell.restoring")} />}>
        <OnboardingFlow
          appState={appState.data}
          addPending={projectActions.addPending}
          error={
            projectActions.error === null
              ? null
              : localizedError(projectActions.error)
          }
          onAddProject={() => void projectActions.add()}
        />
      </Suspense>
    );
  }

  const state = appState.data;
  return (
    <main className="relative flex h-screen min-h-0 overflow-hidden bg-background text-foreground">
      {view.name === "settings" ? (
        <Suspense fallback={<ContentPending label={t("shell.restoring")} />}>
          <SettingsPage
            onBack={() => closeSettings(state.projects.length > 0)}
          />
        </Suspense>
      ) : (
        <>
          <ProjectSidebar
            addPending={projectActions.addPending}
            onAdd={() => void projectActions.add()}
            onLocate={(project) => void projectActions.locate(project)}
            onPersistPreferences={projectActions.persistPanelPreferences}
            onSettings={() =>
              void coordinator.guard(async () => showSettings())
            }
            onRemove={(project) => void projectActions.remove(project)}
            onReveal={(path) => void projectActions.reveal(path)}
            onSelect={(project) => void projectActions.select(project)}
            projects={state.projects}
            selectedProjectPath={selectedProjectPath}
            settingsSelected={false}
          />
          {selectedProject !== undefined ? (
            <WorkspaceView
              onLocate={(project) => void projectActions.locate(project)}
              onPersistPreferences={projectActions.persistPanelPreferences}
              onRetryAppState={() => void appState.refetch()}
              onReveal={(path) => void projectActions.reveal(path)}
              project={selectedProject}
              watcherError={watcherError}
            />
          ) : null}
        </>
      )}
      {state.recoveryWarning !== null && !recoveryDismissed ? (
        <div
          className="absolute left-1/2 top-13 z-[100] flex max-w-xl -translate-x-1/2 items-center gap-2.5 rounded-lg border bg-elevated py-2 pl-3 pr-2 text-warning shadow-overlay"
          role="status"
        >
          <TriangleAlert aria-hidden="true" size={15} />
          <div className="grid min-w-0 text-[11px] text-muted-foreground">
            <strong className="text-xs font-semibold text-foreground">
              {t("shell.stateRecovered")}
            </strong>
            <span>{t("shell.recoveryDescription")}</span>
          </div>
          <Button
            aria-label={t("shell.dismissRecovery")}
            onClick={dismissRecovery}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" size={15} />
          </Button>
        </div>
      ) : null}
      {projectActions.error !== null ? (
        <div
          className="absolute bottom-4 right-4 z-[100] flex max-w-lg items-center gap-2 rounded-lg border bg-elevated py-1.5 pl-2.5 pr-1.5 text-destructive shadow-overlay"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" size={15} />
          <span>{localizedError(projectActions.error)}</span>
          <Button
            aria-label={t("shell.dismissError")}
            onClick={projectActions.clearError}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" size={15} />
          </Button>
        </div>
      ) : null}
    </main>
  );
}

function WindowPending({ label }: { label: string }) {
  return (
    <main className="relative flex h-full w-full items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
      <WindowDragRegion />
      <Spinner />
      {label}
    </main>
  );
}

function ContentPending({ label }: { label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2 bg-workspace text-sm text-muted-foreground">
      <Spinner />
      {label}
    </div>
  );
}

function Spinner() {
  return (
    <span className="size-3.5 animate-spin rounded-full border border-input border-t-muted-foreground" />
  );
}

function WindowDragRegion() {
  return (
    <div className="absolute inset-x-0 top-0 h-12" data-tauri-drag-region />
  );
}
