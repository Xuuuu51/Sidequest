import type { StateCreator } from "zustand";

import type { MainWindowStore, NavigationSlice } from "./types";
import { currentProjectPath } from "./types";

const RESET_WORKSPACE_STATE = {
  searchQuery: "",
  selectedQuestId: null,
  drawerOpen: false,
  issuesExpanded: false,
  projectMenuPath: null,
  editor: null,
  statusMenuOpen: false,
  deleteConfirming: false,
  deleteError: null,
  navigationPending: false,
  navigationIntent: null,
} as const;

export const createNavigationSlice: StateCreator<
  MainWindowStore,
  [],
  [],
  NavigationSlice
> = (set, get) => ({
  view: { name: "restoring" },
  restoreAppState: (appState) => {
    const preferenceState = get().preferencesHydrated
      ? {}
      : { ...appState.panelPreferences, preferencesHydrated: true };

    if (
      appState.projects.length === 0 ||
      appState.onboardingStep !== "complete"
    ) {
      set({
        ...preferenceState,
        ...RESET_WORKSPACE_STATE,
        view: { name: "onboarding" },
      });
      return;
    }

    const state = get();
    const selected = currentProjectPath(state.view);
    const selectedStillExists = appState.projects.some(
      (project) => project.path === selected,
    );
    const nextSelected =
      selectedStillExists && selected !== null
        ? selected
        : (appState.lastSelectedProject ?? appState.projects[0].path);
    const projectChanged = selected !== null && selected !== nextSelected;
    const nextView =
      state.view.name === "settings"
        ? ({ name: "settings", projectPath: nextSelected } as const)
        : ({ name: "workspace", projectPath: nextSelected } as const);

    set({
      ...preferenceState,
      ...(projectChanged ? RESET_WORKSPACE_STATE : {}),
      view: nextView,
    });
  },
  showWorkspace: (projectPath) =>
    set({
      ...RESET_WORKSPACE_STATE,
      view: { name: "workspace", projectPath },
    }),
  showSettings: () =>
    set((state) => ({
      view: {
        name: "settings",
        projectPath: currentProjectPath(state.view),
      },
      drawerOpen: false,
      editor: null,
      statusMenuOpen: false,
      deleteConfirming: false,
    })),
  closeSettings: (hasProjects) =>
    set((state) => ({
      view:
        hasProjects && state.view.name === "settings" && state.view.projectPath
          ? { name: "workspace", projectPath: state.view.projectPath }
          : { name: "onboarding" },
    })),
});
