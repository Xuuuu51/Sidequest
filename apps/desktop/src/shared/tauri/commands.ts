import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type {
  AppStateDto,
  DeletedQuestDto,
  CommandErrorDto,
  PanelPreferencesDto,
  QuestDto,
  QuickCaptureResultDto,
  QuestStatus,
  WorkspaceSnapshotDto,
  SettingsDto,
  ShortcutSpecDto,
  OnboardingStep,
  IntegrationItemDto,
  IntegrationId,
  DiagnosticReportDto,
  LanguagePreference,
  LocaleSettingsDto,
  ThemePreference,
  ThemeSettingsDto,
} from "./types";
import { logDebug, logFrontendError, logInfo } from "../diagnostics/logger";

export function getAppState(): Promise<AppStateDto> {
  return invokeCommand("get_app_state");
}

export function addProject(projectPath: string): Promise<AppStateDto> {
  return invokeCommand("add_project", { projectPath });
}

export function removeProject(
  projectPath: string,
  deleteSidequestData = false,
): Promise<AppStateDto> {
  return invokeCommand("remove_project", { projectPath, deleteSidequestData });
}

export function setLastSelectedProject(
  projectPath: string,
): Promise<AppStateDto> {
  return invokeCommand("set_last_selected_project", { projectPath });
}

export function relocateProject(
  projectPath: string,
  replacementPath: string,
): Promise<AppStateDto> {
  return invokeCommand("relocate_project", { projectPath, replacementPath });
}

export function setPanelPreferences(
  preferences: PanelPreferencesDto,
): Promise<PanelPreferencesDto> {
  return invokeCommand("set_panel_preferences", { preferences });
}

export function saveMainWindowGeometry(): Promise<void> {
  return invokeCommand("save_main_window_geometry");
}

export function hideMainWindow(): Promise<void> {
  return invokeCommand("hide_main_window");
}

export function showQuickCapture(): Promise<void> {
  return invokeCommand("show_quick_capture");
}

export function focusQuickCapture(): Promise<void> {
  return invokeCommand("focus_quick_capture");
}

export function hideQuickCapture(): Promise<void> {
  return invokeCommand("hide_quick_capture");
}

export function saveQuickCapturePosition(): Promise<void> {
  return invokeCommand("save_quick_capture_position");
}

export function completeAppQuit(): Promise<void> {
  return invokeCommand("complete_app_quit");
}

export function loadWorkspace(
  projectPath: string,
): Promise<WorkspaceSnapshotDto> {
  return invokeCommand("load_workspace", { projectPath });
}

export function createQuest(
  projectPath: string,
  content: string,
): Promise<QuestDto> {
  return invokeCommand("create_quest", { projectPath, content });
}

export function captureQuest(
  projectPath: string,
  content: string,
): Promise<QuickCaptureResultDto> {
  return invokeCommand("capture_quest", { projectPath, content });
}

export function updateQuestContent(
  projectPath: string,
  id: string,
  content: string,
): Promise<QuestDto> {
  return invokeCommand("update_quest_content", { projectPath, id, content });
}

export function setQuestStatus(
  projectPath: string,
  id: string,
  status: QuestStatus,
): Promise<QuestDto> {
  return invokeCommand("set_quest_status", { projectPath, id, status });
}

export function deleteQuest(
  projectPath: string,
  id: string,
): Promise<DeletedQuestDto> {
  return invokeCommand("delete_quest", { projectPath, id });
}

export function searchQuests(
  projectPath: string,
  query: string,
): Promise<WorkspaceSnapshotDto> {
  return invokeCommand("search_quests", { projectPath, query });
}

export function setWatchedProject(projectPath: string | null): Promise<void> {
  return invokeCommand("set_watched_project", { projectPath });
}

export function getSettings(): Promise<SettingsDto> {
  return invokeCommand("get_settings");
}

export function getLocaleSettings(): Promise<LocaleSettingsDto> {
  return invokeCommand("get_locale_settings");
}

export function setLocalePreference(
  preference: LanguagePreference,
): Promise<LocaleSettingsDto> {
  return invokeCommand("set_locale_preference", { preference });
}

export function getThemeSettings(): Promise<ThemeSettingsDto> {
  return invokeCommand("get_theme_settings");
}

export function setThemePreference(
  preference: ThemePreference,
): Promise<ThemeSettingsDto> {
  return invokeCommand("set_theme_preference", { preference });
}

export function setGlobalShortcut(
  shortcut: ShortcutSpecDto,
): Promise<SettingsDto> {
  return invokeCommand("set_global_shortcut", { shortcut });
}

export function setLaunchAtLogin(enabled: boolean): Promise<SettingsDto> {
  return invokeCommand("set_launch_at_login", { enabled });
}

export function setOnboardingStep(step: OnboardingStep): Promise<AppStateDto> {
  return invokeCommand("set_onboarding_step", { step });
}

export function getIntegrationStatus(): Promise<IntegrationItemDto[]> {
  return invokeCommand("get_integration_status");
}

export function installCli(): Promise<IntegrationItemDto[]> {
  return invokeCommand("install_cli");
}

export function uninstallCli(): Promise<IntegrationItemDto[]> {
  return invokeCommand("uninstall_cli");
}

export function installAgentSkill(
  agent: Exclude<IntegrationId, "cli">,
): Promise<IntegrationItemDto[]> {
  return invokeCommand("install_agent_skill", { agent });
}

export function uninstallAgentSkill(
  agent: Exclude<IntegrationId, "cli">,
): Promise<IntegrationItemDto[]> {
  return invokeCommand("uninstall_agent_skill", { agent });
}

export function getDiagnosticReport(): Promise<DiagnosticReportDto> {
  return invokeCommand("get_diagnostic_report");
}

export function revealDiagnosticLogs(): Promise<void> {
  return invokeCommand("reveal_diagnostic_logs");
}

export async function copyDiagnosticReport(): Promise<DiagnosticReportDto> {
  const report = await getDiagnosticReport();
  await writeClipboardText(report.report);
  return report;
}

export function writeClipboardText(value: string): Promise<void> {
  return writeText(value);
}

export async function selectReplacementDirectory(
  title = "Locate Sidequest Project",
): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });
  return typeof selected === "string" ? selected : null;
}

export function revealPath(path: string): Promise<void> {
  return revealItemInDir(path);
}

export class CommandError extends Error {
  readonly code: string;
  readonly path: string | null;

  constructor(error: CommandErrorDto) {
    super(error.message);
    this.name = "CommandError";
    this.code = error.code;
    this.path = error.path;
  }
}

async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const startedAt = performance.now();
  logDebug(`command started name=${command}`);
  try {
    const result = await invoke<T>(command, args);
    logInfo(
      `command completed name=${command} duration_ms=${Math.round(performance.now() - startedAt)}`,
    );
    return result;
  } catch (error) {
    const normalized = normalizeCommandError(error);
    if (import.meta.env.DEV) console.error(command, normalized);
    logFrontendError(`command failed name=${command}`, normalized);
    throw normalized;
  }
}

function normalizeCommandError(error: unknown): Error {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new CommandError({
      code: error.code,
      message: error.message,
      path:
        "path" in error &&
        (typeof error.path === "string" || error.path === null)
          ? error.path
          : null,
    });
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function selectProjectDirectory(
  title = "Add Project",
): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title,
  });
  return typeof selected === "string" ? selected : null;
}
