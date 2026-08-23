export type ProjectState = "writable" | "readOnly" | "unavailable";
export type WorkspaceAccess = "writable" | "readOnly";
export type QuestStatus = "inbox" | "ready" | "done";
export type OnboardingStep =
  "addProject" | "quickCapture" | "codingAgents" | "complete";
export type ShortcutModifier = "command" | "control" | "option" | "shift";
export type IntegrationId = "cli" | "codex" | "claude";
export type IntegrationState =
  | "installed"
  | "notInstalled"
  | "updateAvailable"
  | "repairRequired"
  | "conflict"
  | "unavailable";

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
  quickCapture: QuickCapturePreferencesDto;
  onboardingStep: OnboardingStep;
  recoveryWarning: RecoveryWarningDto | null;
}

export interface ShortcutSpecDto {
  modifiers: ShortcutModifier[];
  key: string;
  display: string;
}

export interface SettingsDto {
  shortcut: ShortcutSpecDto;
  shortcutRegistration: "active" | "conflict";
  launchAtLogin: boolean;
  appVersion: string;
  licenseText: string;
}

export interface IntegrationItemDto {
  id: IntegrationId;
  state: IntegrationState;
  path: string;
  installedVersion: string | null;
  bundledVersion: string;
  message: string | null;
}

export interface QuickCapturePreferencesDto {
  lastProjectPath: string | null;
  position: QuickCapturePositionDto | null;
}

export interface QuickCapturePositionDto {
  x: number;
  y: number;
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

export interface QuickCaptureResultDto {
  quest: QuestDto;
  preferenceWarning: CommandErrorDto | null;
}

export interface WorkspaceInvalidatedDto {
  projectPath: string;
}
