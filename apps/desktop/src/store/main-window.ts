import { create } from "zustand";

import type { AppStateDto } from "../shared/tauri/types";

export type MainRoute = "restoring" | "onboarding" | "workspace";

interface MainWindowState {
  route: MainRoute;
  selectedProjectPath: string | null;
  synchronizeAppState: (appState: AppStateDto) => void;
  selectProject: (projectPath: string) => void;
}

export const useMainWindowStore = create<MainWindowState>((set, get) => ({
  route: "restoring",
  selectedProjectPath: null,
  synchronizeAppState: (appState) => {
    if (appState.projects.length === 0) {
      set({ route: "onboarding", selectedProjectPath: null });
      return;
    }

    const selected = get().selectedProjectPath;
    const selectedStillExists = appState.projects.some(
      (project) => project.path === selected,
    );
    const nextSelected = selectedStillExists
      ? selected
      : (appState.lastSelectedProject ?? appState.projects[0].path);
    set({ route: "workspace", selectedProjectPath: nextSelected });
  },
  selectProject: (projectPath) =>
    set({
      route: "workspace",
      selectedProjectPath: projectPath,
    }),
}));
