import { create } from "zustand";

import type {
  AppStateDto,
  PanelPreferencesDto,
  QuestStatus,
} from "../shared/tauri/types";

export type MainRoute = "restoring" | "onboarding" | "workspace";
export type EditorPhase =
  | "viewing"
  | "editing"
  | "pending"
  | "saving"
  | "saveError"
  | "externalConflict";
export type ExternalConflict = "modified" | "deleted";
export type NavigationIntent = "navigation" | "hide" | "quit";

export interface QuestEditorState {
  projectPath: string;
  questId: string;
  createdAt: string;
  status: QuestStatus;
  baseContent: string;
  draftContent: string;
  phase: EditorPhase;
  conflict: ExternalConflict | null;
  error: string | null;
  savedVisible: boolean;
}

export interface DragState {
  questId: string;
  fromStatus: QuestStatus;
  overStatus: QuestStatus;
}

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
  editor: QuestEditorState | null;
  drag: DragState | null;
  statusMenuOpen: boolean;
  deleteConfirming: boolean;
  deleteError: string | null;
  navigationPending: boolean;
  navigationIntent: NavigationIntent | null;
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
  initializeEditor: (
    projectPath: string,
    questId: string,
    content: string,
    createdAt: string,
    status: QuestStatus,
  ) => void;
  setEditorStatus: (status: QuestStatus) => void;
  startEditing: () => void;
  stopEditing: () => void;
  changeDraft: (content: string) => void;
  beginSaving: () => void;
  completeSaving: (savedContent: string) => void;
  failSaving: (message: string) => void;
  clearSavedFeedback: () => void;
  setExternalConflict: (conflict: ExternalConflict) => void;
  loadDiskContent: (content: string) => void;
  clearEditor: () => void;
  setDrag: (drag: DragState | null) => void;
  setStatusMenuOpen: (open: boolean) => void;
  setDeleteConfirming: (confirming: boolean) => void;
  setDeleteError: (message: string | null) => void;
  setNavigationPending: (
    pending: boolean,
    intent?: NavigationIntent | null,
  ) => void;
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
  editor: null,
  drag: null,
  statusMenuOpen: false,
  deleteConfirming: false,
  deleteError: null,
  navigationPending: false,
  navigationIntent: null,
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
        editor: null,
        drag: null,
        statusMenuOpen: false,
        deleteConfirming: false,
        deleteError: null,
        navigationPending: false,
        navigationIntent: null,
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
            editor: null,
            drag: null,
            statusMenuOpen: false,
            deleteConfirming: false,
            deleteError: null,
            navigationPending: false,
            navigationIntent: null,
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
      editor: null,
      drag: null,
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
      navigationPending: false,
      navigationIntent: null,
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
  initializeEditor: (projectPath, questId, content, createdAt, status) =>
    set({
      editor: {
        projectPath,
        questId,
        createdAt,
        status,
        baseContent: content,
        draftContent: content,
        phase: "viewing",
        conflict: null,
        error: null,
        savedVisible: false,
      },
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
    }),
  setEditorStatus: (status) =>
    set((state) =>
      state.editor === null ? {} : { editor: { ...state.editor, status } },
    ),
  startEditing: () =>
    set((state) =>
      state.editor === null || state.editor.phase === "externalConflict"
        ? {}
        : { editor: { ...state.editor, phase: "editing" } },
    ),
  stopEditing: () =>
    set((state) =>
      state.editor === null ||
      state.editor.draftContent !== state.editor.baseContent
        ? {}
        : { editor: { ...state.editor, phase: "viewing" } },
    ),
  changeDraft: (draftContent) =>
    set((state) => {
      if (state.editor === null || state.editor.phase === "externalConflict") {
        return {};
      }
      return {
        editor: {
          ...state.editor,
          draftContent,
          phase:
            draftContent === state.editor.baseContent ? "editing" : "pending",
          error: null,
          savedVisible: false,
        },
      };
    }),
  beginSaving: () =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              phase: "saving",
              error: null,
              savedVisible: false,
            },
          },
    ),
  completeSaving: (savedContent) =>
    set((state) => {
      if (state.editor === null) {
        return {};
      }
      const stillDirty = state.editor.draftContent !== savedContent;
      return {
        editor: {
          ...state.editor,
          baseContent: savedContent,
          phase: stillDirty ? "pending" : "editing",
          conflict: null,
          error: null,
          savedVisible: !stillDirty,
        },
      };
    }),
  failSaving: (error) =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              phase: "saveError",
              error,
              savedVisible: false,
            },
          },
    ),
  clearSavedFeedback: () =>
    set((state) =>
      state.editor === null
        ? {}
        : { editor: { ...state.editor, savedVisible: false } },
    ),
  setExternalConflict: (conflict) =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              phase: "externalConflict",
              conflict,
              error: null,
              savedVisible: false,
            },
          },
    ),
  loadDiskContent: (content) =>
    set((state) =>
      state.editor === null
        ? {}
        : {
            editor: {
              ...state.editor,
              baseContent: content,
              draftContent: content,
              phase: "viewing",
              conflict: null,
              error: null,
              savedVisible: false,
            },
          },
    ),
  clearEditor: () =>
    set({
      editor: null,
      statusMenuOpen: false,
      deleteConfirming: false,
      deleteError: null,
      navigationPending: false,
      navigationIntent: null,
    }),
  setDrag: (drag) => set({ drag }),
  setStatusMenuOpen: (statusMenuOpen) => set({ statusMenuOpen }),
  setDeleteConfirming: (deleteConfirming) =>
    set({ deleteConfirming, deleteError: null }),
  setDeleteError: (deleteError) => set({ deleteError }),
  setNavigationPending: (navigationPending, navigationIntent = null) =>
    set({
      navigationPending,
      navigationIntent: navigationPending ? navigationIntent : null,
    }),
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
