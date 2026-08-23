import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { createDesktopQueryClient } from "./shared/query/client";
import type { AppStateDto, WorkspaceSnapshotDto } from "./shared/tauri/types";
import { useMainWindowStore } from "./store/main-window";

const mocks = vi.hoisted(() => ({
  getAppState: vi.fn(),
  addProject: vi.fn(),
  removeProject: vi.fn(),
  setLastSelectedProject: vi.fn(),
  loadWorkspace: vi.fn(),
  setWatchedProject: vi.fn(),
  selectProjectDirectory: vi.fn(),
  listenForWorkspaceInvalidation: vi.fn(),
}));

vi.mock("./shared/tauri/commands", () => ({
  ...mocks,
  createQuest: vi.fn(),
  updateQuestContent: vi.fn(),
  setQuestStatus: vi.fn(),
  deleteQuest: vi.fn(),
  searchQuests: vi.fn(),
}));

vi.mock("./shared/tauri/events", () => ({
  listenForWorkspaceInvalidation: mocks.listenForWorkspaceInvalidation,
}));

const emptyState: AppStateDto = {
  projects: [],
  lastSelectedProject: null,
  recoveryWarning: null,
};

const projectState: AppStateDto = {
  projects: [{ path: "/project", name: "project", state: "writable" }],
  lastSelectedProject: "/project",
  recoveryWarning: null,
};

const workspace: WorkspaceSnapshotDto = {
  projectPath: "/project",
  access: "writable",
  quests: [],
  issues: [],
};

describe("App", () => {
  beforeEach(() => {
    useMainWindowStore.setState({
      route: "restoring",
      selectedProjectPath: null,
    });
    mocks.getAppState.mockReset().mockResolvedValue(emptyState);
    mocks.addProject.mockReset().mockResolvedValue(projectState);
    mocks.removeProject.mockReset().mockResolvedValue(emptyState);
    mocks.setLastSelectedProject.mockReset().mockResolvedValue(projectState);
    mocks.loadWorkspace.mockReset().mockResolvedValue(workspace);
    mocks.setWatchedProject.mockReset().mockResolvedValue(undefined);
    mocks.selectProjectDirectory.mockReset().mockResolvedValue("/project");
    mocks.listenForWorkspaceInvalidation
      .mockReset()
      .mockResolvedValue(() => undefined);
  });

  it("shows_onboarding_when_no_projects_are_registered", async () => {
    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Add your first project" }),
    ).toBeInTheDocument();
  });

  it("adds_a_project_and_loads_the_real_workspace_route", async () => {
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Add Project" }));

    expect(
      await screen.findByText("No quests yet.", { exact: false }),
    ).toBeInTheDocument();
    expect(mocks.addProject).toHaveBeenCalledWith(
      "/project",
      expect.anything(),
    );
    expect(mocks.loadWorkspace).toHaveBeenCalledWith("/project");
  });

  it("shows_the_recovery_backup_without_blocking_workspace_loading", async () => {
    mocks.getAppState.mockResolvedValue({
      ...projectState,
      recoveryWarning: {
        message: "Desktop state was recovered",
        path: "/data/app.json",
        backupPath: "/data/app.corrupt-1.json",
      },
    });

    renderApp();

    expect(
      await screen.findByText("Desktop state recovered"),
    ).toBeInTheDocument();
    expect(screen.getByText("/data/app.corrupt-1.json")).toBeInTheDocument();
  });
});

function renderApp(): void {
  render(
    <QueryClientProvider client={createDesktopQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}
