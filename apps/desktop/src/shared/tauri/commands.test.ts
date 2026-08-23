import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  revealItemInDir: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: mocks.revealItemInDir,
}));

import {
  addProject,
  completeAppQuit,
  CommandError,
  hideMainWindow,
  relocateProject,
  removeProject,
  revealPath,
  saveMainWindowGeometry,
  selectProjectDirectory,
  selectReplacementDirectory,
  setPanelPreferences,
  setQuestStatus,
  setWatchedProject,
  updateQuestContent,
} from "./commands";

describe("typed Tauri commands", () => {
  beforeEach(() => {
    mocks.invoke.mockReset().mockResolvedValue(undefined);
    mocks.open.mockReset().mockResolvedValue(null);
    mocks.revealItemInDir.mockReset().mockResolvedValue(undefined);
  });

  it("uses_snake_case_commands_with_camel_case_arguments", async () => {
    await addProject("/project");
    await removeProject("/project", true);
    await updateQuestContent("/project", "sq_id", "Changed");
    await setQuestStatus("/project", "sq_id", "ready");
    await setWatchedProject(null);
    await relocateProject("/missing", "/replacement");
    await setPanelPreferences({
      sidebarWidth: 224,
      sidebarCollapsed: false,
      drawerWidth: 480,
    });
    await saveMainWindowGeometry();
    await hideMainWindow();
    await completeAppQuit();

    expect(mocks.invoke.mock.calls).toEqual([
      ["add_project", { projectPath: "/project" }],
      [
        "remove_project",
        { projectPath: "/project", deleteSidequestData: true },
      ],
      [
        "update_quest_content",
        { projectPath: "/project", id: "sq_id", content: "Changed" },
      ],
      [
        "set_quest_status",
        { projectPath: "/project", id: "sq_id", status: "ready" },
      ],
      ["set_watched_project", { projectPath: null }],
      [
        "relocate_project",
        { projectPath: "/missing", replacementPath: "/replacement" },
      ],
      [
        "set_panel_preferences",
        {
          preferences: {
            sidebarWidth: 224,
            sidebarCollapsed: false,
            drawerWidth: 480,
          },
        },
      ],
      ["save_main_window_geometry", undefined],
      ["hide_main_window", undefined],
      ["complete_app_quit", undefined],
    ]);
  });

  it("opens_the_locate_picker_and_reveals_paths_through_official_plugins", async () => {
    mocks.open.mockResolvedValue("/replacement");

    await expect(selectReplacementDirectory()).resolves.toBe("/replacement");
    await revealPath("/project/.sidequest/quests/bad.md");

    expect(mocks.open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Locate Sidequest Project",
    });
    expect(mocks.revealItemInDir).toHaveBeenCalledWith(
      "/project/.sidequest/quests/bad.md",
    );
  });

  it("normalizes_native_error_dtos_without_losing_the_code_or_path", async () => {
    mocks.invoke.mockRejectedValue({
      code: "workspace_unavailable",
      message: "Workspace is unavailable",
      path: "/project",
    });

    const error = await addProject("/project").catch((value: unknown) => value);

    expect(error).toBeInstanceOf(CommandError);
    expect(error).toMatchObject({
      code: "workspace_unavailable",
      message: "Workspace is unavailable",
      path: "/project",
    });
  });

  it("opens_a_single_native_directory_picker", async () => {
    mocks.open.mockResolvedValue("/selected");

    await expect(selectProjectDirectory()).resolves.toBe("/selected");
    expect(mocks.open).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Add Project",
    });
  });
});
