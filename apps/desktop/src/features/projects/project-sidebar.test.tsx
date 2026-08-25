import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSidebar } from "./project-sidebar";
import { useMainWindowStore } from "../../store/main-window/store";

describe("ProjectSidebar", () => {
  beforeEach(() => {
    useMainWindowStore.setState({
      sidebarWidth: 224,
      sidebarCollapsed: true,
      projectMenuPath: null,
    });
  });

  it("previews_the_collapsed_sidebar_on_hover_and_pins_it_on_click", async () => {
    const persistPreferences = vi.fn();
    const selectProject = vi.fn();

    render(
      <ProjectSidebar
        appVersion="0.1.0"
        addPending={false}
        onAdd={vi.fn()}
        onLocate={vi.fn()}
        onPersistPreferences={persistPreferences}
        onRemove={vi.fn()}
        onReveal={vi.fn()}
        onSelect={selectProject}
        onSettings={vi.fn()}
        projects={[{ path: "/project", name: "Project", state: "writable" }]}
        selectedProjectPath="/project"
        settingsSelected={false}
      />,
    );

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).not.toHaveClass("opacity-0");
    fireEvent.pointerEnter(expand);
    expect(
      screen.queryByRole("dialog", { name: "Projects" }),
    ).not.toBeInTheDocument();

    const dialog = await screen.findByRole("dialog", { name: "Projects" });
    expect(within(dialog).getByText("Project")).toBeInTheDocument();
    expect(dialog).toHaveClass("top-2", "bottom-2", "left-2");

    fireEvent.pointerLeave(expand, { relatedTarget: dialog });
    expect(screen.getByRole("dialog", { name: "Projects" })).toBeVisible();

    fireEvent.pointerLeave(dialog, { relatedTarget: document.body });
    expect(screen.getByRole("dialog", { name: "Projects" })).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    });

    fireEvent.pointerEnter(expand);
    const reopened = await screen.findByRole("dialog", { name: "Projects" });
    fireEvent.click(within(reopened).getByText("Project"));
    expect(selectProject).toHaveBeenCalledOnce();

    fireEvent.pointerEnter(expand);
    await screen.findByRole("dialog", { name: "Projects" });

    fireEvent.click(expand);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    });
    expect(useMainWindowStore.getState().sidebarCollapsed).toBe(false);
    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).getByText("Sidequest")).toBeInTheDocument();
    expect(within(sidebar).getByText("v0.1.0")).toBeInTheDocument();
    expect(sidebar.parentElement).toHaveStyle({
      width: "224px",
    });
    expect(persistPreferences).toHaveBeenCalledOnce();

    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(collapse.closest("div")).toHaveClass("left-[78px]");
    expect(screen.getAllByRole("button", { name: /sidebar/i })).toHaveLength(1);
    const projectActions = screen.getByRole("button", {
      name: "Project actions for Project",
    });
    expect(projectActions.parentElement).toHaveAttribute(
      "data-base-ui-tooltip-trigger",
    );
    expect(projectActions.parentElement?.parentElement).toHaveClass(
      "absolute",
      "right-1",
    );

    fireEvent.pointerEnter(collapse);
    expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    fireEvent.click(collapse);

    expect(useMainWindowStore.getState().sidebarCollapsed).toBe(true);
    expect(
      screen.getByRole("complementary", { hidden: true }).parentElement,
    ).toHaveStyle({ width: "0px" });
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }).closest("div"),
    ).toHaveClass("left-[78px]");
    await waitFor(() => {
      expect(persistPreferences).toHaveBeenCalledTimes(2);
    });
  });
});
