import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  AppStateDto,
  DeletedQuestDto,
  QuestDto,
  QuestStatus,
  WorkspaceSnapshotDto,
} from "./types";

export function getAppState(): Promise<AppStateDto> {
  return invoke("get_app_state");
}

export function addProject(projectPath: string): Promise<AppStateDto> {
  return invoke("add_project", { projectPath });
}

export function removeProject(
  projectPath: string,
  deleteSidequestData = false,
): Promise<AppStateDto> {
  return invoke("remove_project", { projectPath, deleteSidequestData });
}

export function setLastSelectedProject(
  projectPath: string,
): Promise<AppStateDto> {
  return invoke("set_last_selected_project", { projectPath });
}

export function loadWorkspace(
  projectPath: string,
): Promise<WorkspaceSnapshotDto> {
  return invoke("load_workspace", { projectPath });
}

export function createQuest(
  projectPath: string,
  content: string,
): Promise<QuestDto> {
  return invoke("create_quest", { projectPath, content });
}

export function updateQuestContent(
  projectPath: string,
  id: string,
  content: string,
): Promise<QuestDto> {
  return invoke("update_quest_content", { projectPath, id, content });
}

export function setQuestStatus(
  projectPath: string,
  id: string,
  status: QuestStatus,
): Promise<QuestDto> {
  return invoke("set_quest_status", { projectPath, id, status });
}

export function deleteQuest(
  projectPath: string,
  id: string,
): Promise<DeletedQuestDto> {
  return invoke("delete_quest", { projectPath, id });
}

export function searchQuests(
  projectPath: string,
  query: string,
): Promise<WorkspaceSnapshotDto> {
  return invoke("search_quests", { projectPath, query });
}

export function setWatchedProject(projectPath: string | null): Promise<void> {
  return invoke("set_watched_project", { projectPath });
}

export async function selectProjectDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Add Project",
  });
  return typeof selected === "string" ? selected : null;
}
