import {
  CaretLeft,
  CaretRight,
  Folder,
  GearSix,
  LockSimple,
  Plus,
  Warning,
  DotsThree,
} from "@phosphor-icons/react";

import type { ProjectDto } from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { ResizeHandle } from "../../shared/ui/resize-handle";
import { useMainWindowStore } from "../../store/main-window";

interface ProjectSidebarProps {
  projects: ProjectDto[];
  selectedProjectPath: string | null;
  addPending: boolean;
  onAdd: () => void;
  onSelect: (project: ProjectDto) => void;
  onLocate: (project: ProjectDto) => void;
  onReveal: (path: string) => void;
  onRemove: (project: ProjectDto) => void;
  onPersistPreferences: () => void;
}

export function ProjectSidebar({
  projects,
  selectedProjectPath,
  addPending,
  onAdd,
  onSelect,
  onLocate,
  onReveal,
  onRemove,
  onPersistPreferences,
}: ProjectSidebarProps) {
  const sidebarWidth = useMainWindowStore((state) => state.sidebarWidth);
  const collapsed = useMainWindowStore((state) => state.sidebarCollapsed);
  const menuPath = useMainWindowStore((state) => state.projectMenuPath);
  const setSidebarWidth = useMainWindowStore((state) => state.setSidebarWidth);
  const setCollapsed = useMainWindowStore((state) => state.setSidebarCollapsed);
  const setMenuPath = useMainWindowStore((state) => state.setProjectMenuPath);

  return (
    <aside
      className={collapsed ? "project-sidebar collapsed" : "project-sidebar"}
      style={{ width: collapsed ? 44 : sidebarWidth }}
    >
      <div className="sidebar-titlebar">
        <div className="titlebar-drag-layer" data-tauri-drag-region />
        <IconButton
          className="sidebar-toggle"
          icon={collapsed ? CaretRight : CaretLeft}
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => {
            setCollapsed(!collapsed);
            queueMicrotask(onPersistPreferences);
          }}
        />
      </div>

      <div className="sidebar-section-heading">
        {!collapsed && <span>Projects</span>}
        <IconButton
          disabled={addPending}
          icon={Plus}
          label="Add Project"
          onClick={onAdd}
        />
      </div>

      <nav aria-label="Projects" className="project-list">
        {projects.map((project) => {
          const selected = project.path === selectedProjectPath;
          return (
            <div className="project-row-wrap" key={project.path}>
              <button
                aria-current={selected ? "page" : undefined}
                className={selected ? "project-row selected" : "project-row"}
                onClick={() => onSelect(project)}
                title={collapsed ? project.name : project.path}
                type="button"
              >
                <ProjectIcon project={project} />
                {!collapsed && (
                  <span className="project-name">{project.name}</span>
                )}
              </button>
              {!collapsed && (
                <IconButton
                  aria-expanded={menuPath === project.path}
                  className="project-menu-trigger"
                  icon={DotsThree}
                  label={`Project actions for ${project.name}`}
                  onClick={() =>
                    setMenuPath(menuPath === project.path ? null : project.path)
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  size={17}
                />
              )}
              {menuPath === project.path && !collapsed && (
                <div
                  className="project-menu"
                  onPointerDown={(event) => event.stopPropagation()}
                  role="menu"
                >
                  {project.state === "unavailable" && (
                    <button
                      onClick={() => {
                        setMenuPath(null);
                        onLocate(project);
                      }}
                      role="menuitem"
                      type="button"
                    >
                      Locate Folder…
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setMenuPath(null);
                      onReveal(project.path);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Reveal in Finder
                  </button>
                  <div className="menu-divider" />
                  <button
                    onClick={() => {
                      setMenuPath(null);
                      onRemove(project);
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Remove Project
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div
        className="sidebar-settings"
        title="Settings will be available in a later stage"
      >
        <button
          aria-disabled="true"
          aria-describedby="settings-unavailable"
          className="settings-row"
          disabled
          type="button"
        >
          <GearSix aria-hidden="true" size={16} weight="regular" />
          {!collapsed && <span>Settings</span>}
        </button>
        <span className="sr-only" id="settings-unavailable">
          Settings will be available in a later stage
        </span>
      </div>

      {!collapsed && (
        <ResizeHandle
          ariaLabel="Resize project sidebar"
          direction={1}
          maximum={320}
          minimum={180}
          onChange={setSidebarWidth}
          onCommit={onPersistPreferences}
          value={sidebarWidth}
        />
      )}
    </aside>
  );
}

function ProjectIcon({ project }: { project: ProjectDto }) {
  if (project.state === "unavailable") {
    return (
      <Warning
        aria-label="Unavailable"
        className="project-state-icon warning-icon"
        size={16}
        weight="regular"
      />
    );
  }
  if (project.state === "readOnly") {
    return (
      <LockSimple
        aria-label="Read only"
        className="project-state-icon"
        size={16}
        weight="regular"
      />
    );
  }
  return <Folder aria-hidden="true" size={16} weight="regular" />;
}
