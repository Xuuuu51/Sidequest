import {
  Folder,
  LockKeyhole,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Settings,
  TriangleAlert,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../../shared/lib/utils";
import type { ProjectDto } from "../../shared/tauri/types";
import { Button } from "../../shared/ui/button";
import { ResizeHandle } from "../../shared/ui/resize-handle";
import { ShortcutHint } from "../../shared/ui/shortcut-hint";
import { Tooltip } from "../../shared/ui/tooltip";
import { useMainWindowStore } from "../../store/main-window/store";
import { DropdownMenu as Menu } from "../../shared/ui/dropdown-menu";
import { Sheet } from "../../shared/ui/sheet";
import { ProjectRemoveDialog } from "./project-remove-dialog";
import sidequestMark from "../../../src-tauri/icons/brand/SidequestMark@2x.png";

const PREVIEW_OPEN_DELAY_MS = 120;
const PREVIEW_CLOSE_DELAY_MS = 180;

interface ProjectSidebarProps {
  appVersion: string | null;
  projects: ProjectDto[];
  selectedProjectPath: string | null;
  addPending: boolean;
  onAdd: () => void;
  onSelect: (project: ProjectDto) => void;
  onLocate: (project: ProjectDto) => void;
  onReveal: (path: string) => void;
  onRemove: (project: ProjectDto, deleteSidequestData: boolean) => void;
  onPersistPreferences: () => void;
  onSettings: () => void;
  settingsSelected: boolean;
}

export function ProjectSidebar({
  appVersion,
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
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<ProjectDto | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const sidebarWidth = useMainWindowStore((state) => state.sidebarWidth);
  const collapsed = useMainWindowStore((state) => state.sidebarCollapsed);
  const menuPath = useMainWindowStore((state) => state.projectMenuPath);
  const setSidebarWidth = useMainWindowStore((state) => state.setSidebarWidth);
  const setCollapsed = useMainWindowStore((state) => state.setSidebarCollapsed);
  const setMenuPath = useMainWindowStore((state) => state.setProjectMenuPath);

  useEffect(
    () => () => {
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  const sharedProps = {
    appVersion,
    projects,
    selectedProjectPath,
    addPending,
    onAdd,
    onSelect,
    onLocate,
    onReveal,
    onRemove: setRemoveCandidate,
    onPersistPreferences,
    onSettings,
    settingsSelected,
    sidebarWidth,
    menuPath,
    setSidebarWidth,
    setMenuPath,
  };

  function cancelOpenDelay(): void {
    if (openTimerRef.current === null) return;
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }

  function cancelCloseDelay(): void {
    if (closeTimerRef.current === null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function closeOverlay(): void {
    cancelOpenDelay();
    cancelCloseDelay();
    setOverlayOpen(false);
    setMenuPath(null);
  }

  function openOverlay(): void {
    cancelOpenDelay();
    cancelCloseDelay();
    setOverlayOpen(true);
  }

  function scheduleOverlayOpen(): void {
    cancelCloseDelay();
    if (overlayOpen || openTimerRef.current !== null) return;

    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      openOverlay();
    }, PREVIEW_OPEN_DELAY_MS);
  }

  function scheduleOverlayClose(): void {
    cancelOpenDelay();
    if (!overlayOpen || closeTimerRef.current !== null) return;

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      closeOverlay();
    }, PREVIEW_CLOSE_DELAY_MS);
  }

  function isInsidePreview(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;
    return (
      triggerRef.current?.contains(target) === true ||
      previewRef.current?.contains(target) === true ||
      (target instanceof Element &&
        target.closest("[data-sidebar-preview-region]") !== null)
    );
  }

  function handlePreviewPointerLeave(event: PointerEvent<HTMLElement>): void {
    if (isInsidePreview(event.relatedTarget)) {
      cancelCloseDelay();
      return;
    }
    scheduleOverlayClose();
  }

  function handlePreviewBlur(event: FocusEvent<HTMLElement>): void {
    if (isInsidePreview(event.relatedTarget)) {
      cancelCloseDelay();
      return;
    }
    scheduleOverlayClose();
  }

  function pinSidebar(): void {
    closeOverlay();
    setCollapsed(false);
    queueMicrotask(onPersistPreferences);
  }

  function toggleSidebar(): void {
    if (collapsed) {
      pinSidebar();
      return;
    }
    closeOverlay();
    setCollapsed(true);
    queueMicrotask(onPersistPreferences);
  }

  return (
    <>
      <div className="absolute left-[78px] top-0 z-[60] flex h-12 w-12 items-center justify-center">
        <Tooltip content={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}>
          <Button
            aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
            aria-expanded={!collapsed || overlayOpen}
            aria-haspopup={collapsed ? "dialog" : undefined}
            onBlur={collapsed ? handlePreviewBlur : undefined}
            onClick={toggleSidebar}
            onFocus={collapsed ? openOverlay : undefined}
            onPointerEnter={collapsed ? scheduleOverlayOpen : undefined}
            onPointerLeave={collapsed ? handlePreviewPointerLeave : undefined}
            onPointerMove={collapsed ? scheduleOverlayOpen : undefined}
            ref={triggerRef}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeft aria-hidden="true" size={17} strokeWidth={1.8} />
          </Button>
        </Tooltip>
      </div>
      <div
        aria-hidden={collapsed}
        className={cn(
          "h-full shrink-0 overflow-hidden transition-[width,opacity] duration-[var(--motion-panel)] ease-out motion-reduce:transition-none",
          collapsed ? "pointer-events-none opacity-0" : "opacity-100",
        )}
        inert={collapsed ? true : undefined}
        style={{ width: collapsed ? 0 : sidebarWidth }}
      >
        <SidebarPanel {...sharedProps} />
      </div>
      {collapsed && (
        <Sheet.Root
          modal={false}
          onOpenChange={(open) => {
            if (open) openOverlay();
            else closeOverlay();
          }}
          open={overlayOpen}
        >
          <Sheet.Portal>
            <Sheet.Popup
              aria-label={t("sidebar.projects")}
              className="fixed bottom-2 left-2 top-2 z-50 overflow-hidden rounded-xl border bg-sidebar text-sidebar-foreground shadow-overlay outline-none transition-[opacity,transform] duration-[var(--motion-panel)] ease-out data-[ending-style]:-translate-x-2 data-[ending-style]:opacity-0 data-[starting-style]:-translate-x-2 data-[starting-style]:opacity-0 motion-reduce:transform-none motion-reduce:transition-opacity"
              finalFocus={false}
              initialFocus={false}
              onBlur={handlePreviewBlur}
              onPointerEnter={cancelCloseDelay}
              onPointerLeave={handlePreviewPointerLeave}
              ref={previewRef}
              style={{ width: sidebarWidth }}
            >
              <Sheet.Title className="sr-only">
                {t("sidebar.projects")}
              </Sheet.Title>
              <SidebarPanel
                {...sharedProps}
                overlay
                onAdd={() => {
                  closeOverlay();
                  onAdd();
                }}
                onSelect={(project) => {
                  closeOverlay();
                  onSelect(project);
                }}
                onSettings={() => {
                  closeOverlay();
                  onSettings();
                }}
              />
            </Sheet.Popup>
          </Sheet.Portal>
        </Sheet.Root>
      )}
      {removeCandidate !== null && (
        <ProjectRemoveDialog
          onCancel={() => setRemoveCandidate(null)}
          onConfirm={(deleteSidequestData) => {
            const project = removeCandidate;
            setRemoveCandidate(null);
            onRemove(project, deleteSidequestData);
          }}
          project={removeCandidate}
        />
      )}
    </>
  );
}

interface SidebarPanelProps extends Omit<ProjectSidebarProps, "onRemove"> {
  sidebarWidth: number;
  menuPath: string | null;
  setSidebarWidth: (width: number) => void;
  setMenuPath: (path: string | null) => void;
  onRemove: (project: ProjectDto) => void;
  overlay?: boolean;
}

function SidebarPanel({
  appVersion,
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
  sidebarWidth,
  menuPath,
  setSidebarWidth,
  setMenuPath,
  overlay = false,
}: SidebarPanelProps) {
  const { t } = useTranslation(["main-window", "common"]);

  return (
    <aside
      className={cn(
        "relative flex h-full shrink-0 flex-col bg-sidebar",
        !overlay && "border-r",
      )}
      style={{ width: sidebarWidth }}
    >
      <div className="h-12 shrink-0" data-tauri-drag-region="deep" />

      <div className="flex h-12 shrink-0 items-center gap-2.5 px-2.5">
        <img
          alt=""
          aria-hidden="true"
          className="size-7 shrink-0 object-contain"
          src={sidequestMark}
        />
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground">
            {t("sidebar.appName")}
          </span>
          <span className="shrink-0 rounded-[4px] bg-muted px-1.5 py-0.5 text-[9px]/[12px] font-semibold text-muted-foreground ring-1 ring-inset ring-border/70">
            {t("sidebar.appVersion", { version: appVersion ?? "—" })}
          </span>
        </div>
      </div>

      <div className="flex h-9 items-center justify-between px-2">
        <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          {t("sidebar.projects")}
        </span>
        <Tooltip content={t("sidebar.addProject")}>
          <Button
            aria-label={t("sidebar.addProject")}
            disabled={addPending}
            onClick={onAdd}
            size="icon"
            variant="ghost"
          >
            <Plus aria-hidden="true" size={15} />
          </Button>
        </Tooltip>
      </div>

      <nav
        aria-label={t("sidebar.projects")}
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5"
      >
        {projects.map((project) => {
          const selected = project.path === selectedProjectPath;
          return (
            <div
              className="group relative flex items-center"
              key={project.path}
            >
              <button
                aria-current={selected ? "page" : undefined}
                className={`relative flex h-9 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md border-transparent px-2 text-left text-[13px] outline-none transition-[background-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? "bg-surface text-surface-foreground shadow-control before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-brand" : "bg-transparent text-foreground"}`}
                onClick={() => onSelect(project)}
                title={project.path}
                type="button"
              >
                <ProjectIcon project={project} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
              </button>
              <ProjectMenu
                onLocate={() => onLocate(project)}
                onOpenChange={(open) => setMenuPath(open ? project.path : null)}
                onRemove={() => onRemove(project)}
                onReveal={() => onReveal(project.path)}
                open={menuPath === project.path}
                project={project}
              />
            </div>
          );
        })}
      </nav>

      <div className="border-t p-1.5">
        <button
          aria-current={settingsSelected ? "page" : undefined}
          className={`relative flex h-9 w-full items-center gap-2 overflow-hidden rounded-md border-transparent px-2 text-[13px] outline-none transition-[background-color,box-shadow] hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${settingsSelected ? "bg-surface text-surface-foreground shadow-control before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-brand" : "bg-transparent text-foreground"}`}
          onClick={onSettings}
          type="button"
        >
          <Settings aria-hidden="true" size={16} />
          <span className="min-w-0 flex-1 text-left">
            {t("sidebar.settings")}
          </span>
          <ShortcutHint
            density="compact"
            shortcut={t("sidebar.settingsShortcut")}
          />
        </button>
      </div>

      <ResizeHandle
        ariaLabel={t("sidebar.resize")}
        direction={1}
        maximum={320}
        minimum={180}
        onChange={setSidebarWidth}
        onCommit={onPersistPreferences}
        value={sidebarWidth}
      />
    </aside>
  );
}

function ProjectMenu({
  project,
  open,
  onOpenChange,
  onLocate,
  onReveal,
  onRemove,
}: {
  project: ProjectDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLocate: () => void;
  onReveal: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation(["main-window", "common"]);
  const itemClass =
    "flex h-8 cursor-default items-center rounded-sm px-2 text-[13px] outline-none data-[highlighted]:bg-accent";
  return (
    <Menu.Root onOpenChange={onOpenChange} open={open}>
      <span className="absolute right-1 inline-flex">
        <Tooltip content={t("sidebar.actionsFor", { name: project.name })}>
          <Menu.Trigger
            aria-label={t("sidebar.actionsFor", { name: project.name })}
            className="inline-flex size-7 items-center justify-center rounded-md border-transparent bg-transparent text-muted-foreground opacity-0 outline-none hover:bg-accent hover:text-foreground focus:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal aria-hidden="true" size={16} />
          </Menu.Trigger>
        </Tooltip>
      </span>
      <Menu.Portal>
        <Menu.Positioner
          align="end"
          data-sidebar-preview-region
          side="right"
          sideOffset={6}
          className="z-50 outline-none"
        >
          <Menu.Popup className="min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-overlay outline-none">
            {project.state === "unavailable" && (
              <Menu.Item className={itemClass} onClick={onLocate}>
                {t("actions.locateFolder", { ns: "common" })}
              </Menu.Item>
            )}
            <Menu.Item className={itemClass} onClick={onReveal}>
              {t("actions.revealInFinder", { ns: "common" })}
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              className={`${itemClass} text-destructive`}
              onClick={onRemove}
            >
              {t("sidebar.removeProject")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ProjectIcon({ project }: { project: ProjectDto }) {
  const { t } = useTranslation("common");
  if (project.state === "unavailable") {
    return (
      <TriangleAlert
        aria-label={t("projectState.unavailable")}
        className="shrink-0 text-warning"
        size={16}
      />
    );
  }
  if (project.state === "readOnly") {
    return (
      <LockKeyhole
        aria-label={t("projectState.readOnly")}
        className="shrink-0 text-muted-foreground"
        size={16}
      />
    );
  }
  return <Folder aria-hidden="true" size={16} />;
}
