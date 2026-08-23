import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));

import {
  addProject,
  removeProject,
  selectProjectDirectory,
  setQuestStatus,
  setWatchedProject,
  updateQuestContent,
} from "./commands";

describe("typed Tauri commands", () => {
  beforeEach(() => {
    mocks.invoke.mockReset().mockResolvedValue(undefined);
    mocks.open.mockReset().mockResolvedValue(null);
  });

  it("uses_snake_case_commands_with_camel_case_arguments", async () => {
    await addProject("/project");
    await removeProject("/project", true);
    await updateQuestContent("/project", "sq_id", "Changed");
    await setQuestStatus("/project", "sq_id", "ready");
    await setWatchedProject(null);

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
    ]);
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
