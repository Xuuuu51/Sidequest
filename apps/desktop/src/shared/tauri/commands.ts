import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type {
  AppStateDto,
  DeletedQuestDto,
  CommandErrorDto,
  PanelPreferencesDto,
  QuestDto,
  QuestStatus,
  WorkspaceSnapshotDto,
} from "./types";

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

export async function selectReplacementDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Locate Sidequest Project",
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
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw normalizeCommandError(error);
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

export async function selectProjectDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Add Project",
  });
  return typeof selected === "string" ? selected : null;
}
