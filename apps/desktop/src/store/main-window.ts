import { create } from "zustand";

import type {
  AppStateDto,
  PanelPreferencesDto,
  QuestStatus,
} from "../shared/tauri/types";

export type MainRoute = "restoring" | "onboarding" | "workspace";

const DEFAULT_PREFERENCES: PanelPreferencesDto = {
  sidebarWidth: 224,
  sidebarCollapsed: false,
  drawerWidth: 480,
};

interface MainWindowState {
  route: MainRoute;
  selectedProjectPath: string | null;
  searchQuery: string;
  selectedQuestId: string | null;
  drawerOpen: boolean;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  drawerWidth: number;
  preferencesHydrated: boolean;
  laneScrollPositions: Record<string, number>;
  issuesExpanded: boolean;
  projectMenuPath: string | null;
  recoveryDismissed: boolean;
  toast: string | null;
  synchronizeAppState: (appState: AppStateDto) => void;
  selectProject: (projectPath: string) => void;
  setSearchQuery: (query: string) => void;
  selectQuest: (questId: string) => void;
  closeDrawer: () => void;
  openSelectedQuest: () => void;
  clearSelection: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDrawerWidth: (width: number) => void;
  setLaneScrollPosition: (
    projectPath: string,
    status: QuestStatus,
    scrollTop: number,
  ) => void;
  toggleIssues: () => void;
  setProjectMenuPath: (projectPath: string | null) => void;
  dismissRecovery: () => void;
  showToast: (message: string | null) => void;
}

export const useMainWindowStore = create<MainWindowState>((set, get) => ({
  route: "restoring",
  selectedProjectPath: null,
  searchQuery: "",
  selectedQuestId: null,
  drawerOpen: false,
  ...DEFAULT_PREFERENCES,
  preferencesHydrated: false,
  laneScrollPositions: {},
  issuesExpanded: false,
  projectMenuPath: null,
  recoveryDismissed: false,
  toast: null,
  synchronizeAppState: (appState) => {
    const preferenceState = get().preferencesHydrated
      ? {}
      : {
          ...appState.panelPreferences,
          preferencesHydrated: true,
        };
    if (appState.projects.length === 0) {
      set({
        ...preferenceState,
        route: "onboarding",
        selectedProjectPath: null,
        searchQuery: "",
        selectedQuestId: null,
        drawerOpen: false,
        projectMenuPath: null,
      });
      return;
    }

    const selected = get().selectedProjectPath;
    const selectedStillExists = appState.projects.some(
      (project) => project.path === selected,
    );
    const nextSelected = selectedStillExists
      ? selected
      : (appState.lastSelectedProject ?? appState.projects[0].path);
    const projectChanged = selected !== null && selected !== nextSelected;
    set({
      ...preferenceState,
      route: "workspace",
      selectedProjectPath: nextSelected,
      ...(projectChanged
        ? {
            searchQuery: "",
            selectedQuestId: null,
            drawerOpen: false,
            issuesExpanded: false,
            projectMenuPath: null,
          }
        : {}),
    });
  },
  selectProject: (projectPath) =>
    set({
      route: "workspace",
      selectedProjectPath: projectPath,
      searchQuery: "",
      selectedQuestId: null,
      drawerOpen: false,
      issuesExpanded: false,
      projectMenuPath: null,
    }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  selectQuest: (selectedQuestId) => set({ selectedQuestId, drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  openSelectedQuest: () => {
    if (get().selectedQuestId !== null) {
      set({ drawerOpen: true });
    }
  },
  clearSelection: () => set({ selectedQuestId: null, drawerOpen: false }),
  setSidebarWidth: (sidebarWidth) =>
    set({ sidebarWidth: clamp(sidebarWidth, 180, 320) }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setDrawerWidth: (drawerWidth) =>
    set({ drawerWidth: clamp(drawerWidth, 420, 560) }),
  setLaneScrollPosition: (projectPath, status, scrollTop) =>
    set((state) => ({
      laneScrollPositions: {
        ...state.laneScrollPositions,
        [laneScrollKey(projectPath, status)]: scrollTop,
      },
    })),
  toggleIssues: () =>
    set((state) => ({ issuesExpanded: !state.issuesExpanded })),
  setProjectMenuPath: (projectMenuPath) => set({ projectMenuPath }),
  dismissRecovery: () => set({ recoveryDismissed: true }),
  showToast: (toast) => set({ toast }),
}));

export function laneScrollKey(
  projectPath: string,
  status: QuestStatus,
): string {
  return `${projectPath}\u0000${status}`;
}

export function currentPanelPreferences(
  state: Pick<
    MainWindowState,
    "sidebarWidth" | "sidebarCollapsed" | "drawerWidth"
  >,
): PanelPreferencesDto {
  return {
    sidebarWidth: state.sidebarWidth,
    sidebarCollapsed: state.sidebarCollapsed,
    drawerWidth: state.drawerWidth,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
