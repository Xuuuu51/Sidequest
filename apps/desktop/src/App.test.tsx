import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  searchQuests: vi.fn(),
  setWatchedProject: vi.fn(),
  relocateProject: vi.fn(),
  setPanelPreferences: vi.fn(),
  saveMainWindowGeometry: vi.fn(),
  revealPath: vi.fn(),
  selectProjectDirectory: vi.fn(),
  selectReplacementDirectory: vi.fn(),
  listenForWorkspaceInvalidation: vi.fn(),
}));

vi.mock("./shared/tauri/commands", () => ({
  ...mocks,
  createQuest: vi.fn(),
  updateQuestContent: vi.fn(),
  setQuestStatus: vi.fn(),
  deleteQuest: vi.fn(),
}));

vi.mock("./shared/tauri/events", () => ({
  listenForWorkspaceInvalidation: mocks.listenForWorkspaceInvalidation,
}));

vi.mock("./features/window/use-window-geometry", () => ({
  useWindowGeometryPersistence: vi.fn(),
}));

const emptyState: AppStateDto = {
  projects: [],
  lastSelectedProject: null,
  panelPreferences: {
    sidebarWidth: 224,
    sidebarCollapsed: false,
    drawerWidth: 480,
  },
  recoveryWarning: null,
};

const projectState: AppStateDto = {
  projects: [{ path: "/project", name: "project", state: "writable" }],
  lastSelectedProject: "/project",
  panelPreferences: emptyState.panelPreferences,
  recoveryWarning: null,
};

const workspace: WorkspaceSnapshotDto = {
  projectPath: "/project",
  access: "writable",
  quests: [],
  issues: [],
};

const populatedWorkspace: WorkspaceSnapshotDto = {
  ...workspace,
  quests: [
    {
      id: "sq_inbox",
      createdAt: "2026-08-23T10:00:00+08:00",
      content: "Inbox quest content",
      status: "inbox",
    },
    {
      id: "sq_ready",
      createdAt: "2026-08-22T10:00:00+08:00",
      content: "Ready quest content",
      status: "ready",
    },
    {
      id: "sq_done",
      createdAt: "2026-08-21T10:00:00+08:00",
      content: "Done quest content",
      status: "done",
    },
  ],
};

describe("App", () => {
  beforeEach(() => {
    useMainWindowStore.setState({
      route: "restoring",
      selectedProjectPath: null,
      searchQuery: "",
      selectedQuestId: null,
      drawerOpen: false,
      sidebarWidth: 224,
      sidebarCollapsed: false,
      drawerWidth: 480,
      preferencesHydrated: false,
      laneScrollPositions: {},
      issuesExpanded: false,
      projectMenuPath: null,
      recoveryDismissed: false,
      toast: null,
    });
    mocks.getAppState.mockReset().mockResolvedValue(emptyState);
    mocks.addProject.mockReset().mockResolvedValue(projectState);
    mocks.removeProject.mockReset().mockResolvedValue(emptyState);
    mocks.setLastSelectedProject.mockReset().mockResolvedValue(projectState);
    mocks.loadWorkspace.mockReset().mockResolvedValue(workspace);
    mocks.searchQuests.mockReset().mockResolvedValue(workspace);
    mocks.setWatchedProject.mockReset().mockResolvedValue(undefined);
    mocks.setPanelPreferences
      .mockReset()
      .mockResolvedValue(emptyState.panelPreferences);
    mocks.saveMainWindowGeometry.mockReset().mockResolvedValue(undefined);
    mocks.revealPath.mockReset().mockResolvedValue(undefined);
    mocks.relocateProject.mockReset().mockResolvedValue(projectState);
    mocks.selectProjectDirectory.mockReset().mockResolvedValue("/project");
    mocks.selectReplacementDirectory.mockReset().mockResolvedValue(null);
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Choose Folder…" }),
    );

    expect(await screen.findByText("No quests yet")).toBeInTheDocument();
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

  it("renders_three_lanes_and_keeps_selection_when_the_drawer_closes", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);

    renderApp();

    expect(
      await screen.findByRole("heading", { name: "Inbox" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Done" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Inbox quest content/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Quest details" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close Quest details" }),
    );

    expect(
      screen.queryByRole("heading", { name: "Quest details" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Inbox quest content/ }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Open Quest details" }));
    expect(
      screen.getByRole("heading", { name: "Quest details" }),
    ).toBeInTheDocument();
  });

  it("searches_the_current_project_and_clears_back_to_the_board", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    mocks.searchQuests.mockResolvedValue({
      ...populatedWorkspace,
      quests: [populatedWorkspace.quests[1]],
    });
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });

    fireEvent.change(
      screen.getByRole("textbox", { name: "Search current project" }),
      {
        target: { value: "ready" },
      },
    );

    expect(
      await screen.findByRole("heading", { name: "Search results" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ready quest content")).toBeInTheDocument();
    expect(mocks.searchQuests).toHaveBeenCalledWith("/project", "ready");
    fireEvent.click(screen.getByRole("button", { name: "Clear Search" }));
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("shows_read_only_and_corrupt_file_banners_without_hiding_valid_quests", async () => {
    mocks.getAppState.mockResolvedValue({
      ...projectState,
      projects: [{ ...projectState.projects[0], state: "readOnly" }],
    });
    mocks.loadWorkspace.mockResolvedValue({
      ...populatedWorkspace,
      access: "readOnly",
      issues: [
        { path: "/project/.sidequest/quests/bad.md", message: "Invalid file" },
      ],
    });

    renderApp();

    expect(
      await screen.findByText(/project is read-only/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Inbox quest content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Details" }));
    expect(
      screen.getByText("/project/.sidequest/quests/bad.md"),
    ).toBeInTheDocument();
  });

  it("offers_locate_for_an_unavailable_project_without_loading_it", async () => {
    mocks.getAppState.mockResolvedValue({
      ...projectState,
      projects: [{ ...projectState.projects[0], state: "unavailable" }],
    });
    mocks.selectReplacementDirectory.mockResolvedValue("/replacement");
    mocks.relocateProject.mockResolvedValue({
      ...projectState,
      projects: [
        { path: "/replacement", name: "replacement", state: "writable" },
      ],
      lastSelectedProject: "/replacement",
    });

    renderApp();
    fireEvent.click(
      await screen.findByRole("button", { name: /Locate Folder/ }),
    );

    await waitFor(() =>
      expect(mocks.relocateProject).toHaveBeenCalledWith(
        "/project",
        "/replacement",
      ),
    );
    expect(mocks.loadWorkspace).not.toHaveBeenCalledWith("/project");
  });

  it("keeps_settings_visible_but_disabled", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    renderApp();

    expect(
      await screen.findByRole("button", { name: "Settings" }),
    ).toBeDisabled();
  });

  it("supports_command_f_and_escape_for_search", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    mocks.loadWorkspace.mockResolvedValue(populatedWorkspace);
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });
    const search = screen.getByRole("textbox", {
      name: "Search current project",
    });

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "ready" } });
    fireEvent.keyDown(window, { key: "Escape" });

    expect(search).toHaveValue("");
    expect(search).not.toHaveFocus();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeInTheDocument();
  });

  it("removes_a_project_from_its_context_menu_without_deleting_data", async () => {
    mocks.getAppState.mockResolvedValue(projectState);
    renderApp();
    await screen.findByRole("heading", { name: "Inbox" });

    fireEvent.click(
      screen.getByRole("button", { name: "Project actions for project" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove Project" }));

    await waitFor(() =>
      expect(mocks.removeProject).toHaveBeenCalledWith("/project"),
    );
  });
});

function renderApp(): void {
  render(
    <QueryClientProvider client={createDesktopQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}
