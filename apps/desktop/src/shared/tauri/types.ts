export type ProjectState = "writable" | "readOnly" | "unavailable";
export type WorkspaceAccess = "writable" | "readOnly";
export type QuestStatus = "inbox" | "ready" | "done";

export interface RecoveryWarningDto {
  message: string;
  path: string;
  backupPath: string;
}

export interface ProjectDto {
  path: string;
  name: string;
  state: ProjectState;
}

export interface AppStateDto {
  projects: ProjectDto[];
  lastSelectedProject: string | null;
  panelPreferences: PanelPreferencesDto;
  recoveryWarning: RecoveryWarningDto | null;
}

export interface PanelPreferencesDto {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  drawerWidth: number;
}

export interface QuestDto {
  id: string;
  createdAt: string;
  content: string;
  status: QuestStatus;
}

export interface QuestFileIssueDto {
  path: string;
  message: string;
}

export interface WorkspaceSnapshotDto {
  projectPath: string;
  access: WorkspaceAccess;
  quests: QuestDto[];
  issues: QuestFileIssueDto[];
}

export interface DeletedQuestDto {
  id: string;
}

export interface CommandErrorDto {
  code: string;
  message: string;
  path: string | null;
}

export interface WorkspaceInvalidatedDto {
  projectPath: string;
}
