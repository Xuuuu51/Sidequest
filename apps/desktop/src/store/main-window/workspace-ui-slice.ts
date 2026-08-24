import type { StateCreator } from "zustand";

import type { MainWindowStore, WorkspaceUiSlice } from "./types";
import { laneScrollKey } from "./types";

export const createWorkspaceUiSlice: StateCreator<
  MainWindowStore,
  [],
  [],
  WorkspaceUiSlice
> = (set, get) => ({
  searchQuery: "",
  selectedQuestId: null,
  drawerOpen: false,
  laneScrollPositions: {},
  issuesExpanded: false,
  projectMenuPath: null,
  recoveryDismissed: false,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  selectQuest: (selectedQuestId) => set({ selectedQuestId, drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  openSelectedQuest: () => {
    if (get().selectedQuestId !== null) set({ drawerOpen: true });
  },
  clearSelection: () => set({ selectedQuestId: null, drawerOpen: false }),
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
});
