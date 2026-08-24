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
import { useTranslation } from "react-i18next";

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
  onSettings: () => void;
  settingsSelected: boolean;
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
  onSettings,
  settingsSelected,
}: ProjectSidebarProps) {
  const { t } = useTranslation(["main-window", "common"]);
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
          label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          onClick={() => {
            setCollapsed(!collapsed);
            queueMicrotask(onPersistPreferences);
          }}
        />
      </div>

      <div className="sidebar-section-heading">
        {!collapsed && <span>{t("sidebar.projects")}</span>}
        <IconButton
          disabled={addPending}
          icon={Plus}
          label={t("sidebar.addProject")}
          onClick={onAdd}
        />
      </div>

      <nav aria-label={t("sidebar.projects")} className="project-list">
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
                  label={t("sidebar.actionsFor", { name: project.name })}
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
                      {t("actions.locateFolder", { ns: "common" })}
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
                    {t("actions.revealInFinder", { ns: "common" })}
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
                    {t("sidebar.removeProject")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-settings">
        <button
          aria-current={settingsSelected ? "page" : undefined}
          className={
            settingsSelected ? "settings-row selected" : "settings-row"
          }
          onClick={onSettings}
          type="button"
        >
          <GearSix aria-hidden="true" size={16} weight="regular" />
          {!collapsed && <span>{t("sidebar.settings")}</span>}
        </button>
      </div>

      {!collapsed && (
        <ResizeHandle
          ariaLabel={t("sidebar.resize")}
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
  const { t } = useTranslation("common");
  if (project.state === "unavailable") {
    return (
      <Warning
        aria-label={t("projectState.unavailable")}
        className="project-state-icon warning-icon"
        size={16}
        weight="regular"
      />
    );
  }
  if (project.state === "readOnly") {
    return (
      <LockSimple
        aria-label={t("projectState.readOnly")}
        className="project-state-icon"
        size={16}
        weight="regular"
      />
    );
  }
  return <Folder aria-hidden="true" size={16} weight="regular" />;
}
