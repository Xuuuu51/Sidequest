import type {
  AppStateDto,
  PanelPreferencesDto,
  QuestStatus,
} from "../../shared/tauri/types";

export type MainView =
  | { name: "restoring" }
  | { name: "onboarding" }
  | { name: "workspace"; projectPath: string }
  | { name: "settings"; projectPath: string | null };

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

export interface NavigationSlice {
  view: MainView;
  restoreAppState: (appState: AppStateDto) => void;
  showWorkspace: (projectPath: string) => void;
  showSettings: () => void;
  closeSettings: (hasProjects: boolean) => void;
}

export interface WorkspaceUiSlice {
  searchQuery: string;
  selectedQuestId: string | null;
  drawerOpen: boolean;
  laneScrollPositions: Record<string, number>;
  issuesExpanded: boolean;
  projectMenuPath: string | null;
  recoveryDismissed: boolean;
  setSearchQuery: (query: string) => void;
  selectQuest: (questId: string) => void;
  closeDrawer: () => void;
  openSelectedQuest: () => void;
  clearSelection: () => void;
  setLaneScrollPosition: (
    projectPath: string,
    status: QuestStatus,
    scrollTop: number,
  ) => void;
  toggleIssues: () => void;
  setProjectMenuPath: (projectPath: string | null) => void;
  dismissRecovery: () => void;
}

export interface EditorSlice {
  editor: QuestEditorState | null;
  statusMenuOpen: boolean;
  deleteConfirming: boolean;
  deleteError: string | null;
  navigationPending: boolean;
  navigationIntent: NavigationIntent | null;
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
  setStatusMenuOpen: (open: boolean) => void;
  setDeleteConfirming: (confirming: boolean) => void;
  setDeleteError: (message: string | null) => void;
  setNavigationPending: (
    pending: boolean,
    intent?: NavigationIntent | null,
  ) => void;
}

export interface ShellPreferencesSlice {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  drawerWidth: number;
  preferencesHydrated: boolean;
  setSidebarWidth: (width: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDrawerWidth: (width: number) => void;
}

export type MainWindowStore = NavigationSlice &
  WorkspaceUiSlice &
  EditorSlice &
  ShellPreferencesSlice;

export type PanelPreferenceState = Pick<
  MainWindowStore,
  "sidebarWidth" | "sidebarCollapsed" | "drawerWidth"
>;

export function currentProjectPath(view: MainView): string | null {
  return view.name === "workspace" || view.name === "settings"
    ? view.projectPath
    : null;
}

export function currentPanelPreferences(
  state: PanelPreferenceState,
): PanelPreferencesDto {
  return {
    sidebarWidth: state.sidebarWidth,
    sidebarCollapsed: state.sidebarCollapsed,
    drawerWidth: state.drawerWidth,
  };
}

export function laneScrollKey(
  projectPath: string,
  status: QuestStatus,
): string {
  return `${projectPath}\u0000${status}`;
}
