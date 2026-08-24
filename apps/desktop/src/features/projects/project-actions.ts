import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { usePanelPreferencesMutation } from "../app-state/data";
import { useQuestWriteCoordinator } from "../quests/quest-write-coordinator";
import { workspaceOptions } from "../workspace/data";
import {
  currentPanelPreferences,
  currentProjectPath,
} from "../../store/main-window/types";
import { useMainWindowStore } from "../../store/main-window/store";
import {
  revealPath,
  selectProjectDirectory,
  selectReplacementDirectory,
} from "../../shared/tauri/commands";
import type { ProjectDto } from "../../shared/tauri/types";
import {
  useAddProjectMutation,
  useRelocateProjectMutation,
  useRemoveProjectMutation,
  useSelectProjectMutation,
} from "./data";

export function useProjectActions() {
  const { t } = useTranslation(["main-window", "common"]);
  const queryClient = useQueryClient();
  const coordinator = useQuestWriteCoordinator();
  const addProject = useAddProjectMutation();
  const removeProject = useRemoveProjectMutation();
  const relocateProject = useRelocateProjectMutation();
  const selectProjectMutation = useSelectProjectMutation();
  const panelPreferences = usePanelPreferencesMutation();
  const view = useMainWindowStore((state) => state.view);
  const restoreAppState = useMainWindowStore((state) => state.restoreAppState);
  const showWorkspace = useMainWindowStore((state) => state.showWorkspace);
  const [error, setError] = useState<Error | null>(null);
  const selectedProjectPath = currentProjectPath(view);

  async function add(): Promise<void> {
    setError(null);
    try {
      const projectPath = await selectProjectDirectory(t("sidebar.addProject"));
      if (projectPath === null) return;
      await coordinator.guard(async () => {
        const nextState = await addProject.mutateAsync(projectPath);
        if (nextState.lastSelectedProject !== null) {
          showWorkspace(nextState.lastSelectedProject);
        }
      });
    } catch (cause) {
      setError(toError(cause));
    }
  }

  async function select(project: ProjectDto): Promise<void> {
    if (project.path === selectedProjectPath) return;
    setError(null);
    try {
      await coordinator.guard(async () => {
        const prefetch = queryClient.prefetchQuery(
          workspaceOptions(project.path),
        );
        await selectProjectMutation.mutateAsync(project.path);
        showWorkspace(project.path);
        void prefetch;
      });
    } catch (cause) {
      setError(toError(cause));
    }
  }

  async function remove(project: ProjectDto): Promise<void> {
    setError(null);
    try {
      const run = async () => {
        const nextState = await removeProject.mutateAsync(project.path);
        restoreAppState(nextState);
      };
      if (project.path === selectedProjectPath) await coordinator.guard(run);
      else await run();
    } catch (cause) {
      setError(toError(cause));
    }
  }

  async function locate(project: ProjectDto): Promise<void> {
    setError(null);
    try {
      const replacementPath = await selectReplacementDirectory(
        t("actions.locateFolder", { ns: "common" }),
      );
      if (replacementPath === null) return;
      const nextState = await relocateProject.mutateAsync({
        projectPath: project.path,
        replacementPath,
      });
      restoreAppState(nextState);
      if (nextState.lastSelectedProject !== null) {
        showWorkspace(nextState.lastSelectedProject);
      }
    } catch (cause) {
      setError(toError(cause));
    }
  }

  async function reveal(path: string): Promise<void> {
    setError(null);
    try {
      await revealPath(path);
    } catch (cause) {
      setError(toError(cause));
    }
  }

  function persistPanelPreferences(): void {
    const preferences = currentPanelPreferences(useMainWindowStore.getState());
    panelPreferences.mutate(preferences, {
      onError: (cause) => setError(toError(cause)),
    });
  }

  return {
    addPending: addProject.isPending,
    error,
    clearError: () => setError(null),
    add,
    locate,
    persistPanelPreferences,
    remove,
    reveal,
    select,
  };
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
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
