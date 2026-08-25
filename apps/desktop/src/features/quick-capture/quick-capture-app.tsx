import {
  Check,
  ChevronDown,
  Folder,
  FolderPlus,
  CircleAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppStateInvalidation, useAppStateQuery } from "../app-state/data";
import { useAddProjectMutation } from "../projects/data";
import { useCaptureQuestMutation } from "./data";
import {
  focusQuickCapture,
  hideQuickCapture,
  saveQuickCapturePosition,
  selectProjectDirectory,
} from "../../shared/tauri/commands";
import {
  listenForDebugReloadRequest,
  listenForQuickCaptureCloseRequest,
  listenForQuickCaptureShown,
} from "../../shared/tauri/events";
import { logFrontendError } from "../../shared/diagnostics/logger";
import type { ProjectDto } from "../../shared/tauri/types";
import {
  listenForCurrentWindowClose,
  listenForCurrentWindowMove,
  setCurrentWindowTitle,
} from "../../shared/tauri/window";
import { IconButton } from "../../shared/ui/icon-button";
import { Button } from "../../shared/ui/button";
import { Textarea } from "../../shared/ui/textarea";
import { ShortcutHint } from "../../shared/ui/shortcut-hint";
import { cn } from "../../shared/lib/utils";
import { useQuickCaptureStore } from "../../store/quick-capture";

const SUCCESS_DELAY_MS = 500;
const POSITION_DEBOUNCE_MS = 250;

export function QuickCaptureApp() {
  const { t } = useTranslation(["quick-capture", "common"]);
  useAppStateInvalidation();
  const appState = useAppStateQuery();
  const addProject = useAddProjectMutation();
  const capture = useCaptureQuestMutation();
  const draft = useQuickCaptureStore((state) => state.draft);
  const selectedProjectPath = useQuickCaptureStore(
    (state) => state.selectedProjectPath,
  );
  const phase = useQuickCaptureStore((state) => state.phase);
  const error = useQuickCaptureStore((state) => state.error);
  const setDraft = useQuickCaptureStore((state) => state.setDraft);
  const setSelectedProjectPath = useQuickCaptureStore(
    (state) => state.setSelectedProjectPath,
  );
  const setPhase = useQuickCaptureStore((state) => state.setPhase);
  const clearDraft = useQuickCaptureStore((state) => state.clearDraft);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const projectSelectorRef = useRef<HTMLDivElement>(null);
  const projectSelectorTriggerRef = useRef<HTMLButtonElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const syncedProjectPathRef = useRef<string | null | undefined>(undefined);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const refetchAppState = appState.refetch;

  const projects = appState.data?.projects ?? [];
  const selectedProject = projects.find(
    (project) => project.path === selectedProjectPath,
  );

  useEffect(() => {
    const title = t("title");
    document.title = title;
    void setCurrentWindowTitle(title).catch((cause: unknown) =>
      logFrontendError("Quick Capture title update failed", cause),
    );
  }, [t]);

  useEffect(() => {
    if (appState.data === undefined) {
      return;
    }
    const currentStillExists = appState.data.projects.some(
      (project) => project.path === selectedProjectPath,
    );
    const preferredProjectPath = appState.data.quickCapture.lastProjectPath;
    if (
      !currentStillExists ||
      syncedProjectPathRef.current !== preferredProjectPath
    ) {
      setSelectedProjectPath(preferredProjectPath);
    }
    syncedProjectPathRef.current = preferredProjectPath;
  }, [appState.data, selectedProjectPath, setSelectedProjectPath]);

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const focusPanelOnPointerEnter = useCallback(() => {
    void focusQuickCapture()
      .then(focusInput)
      .catch((cause: unknown) =>
        logFrontendError("Quick Capture hover focus failed", cause),
      );
  }, [focusInput]);

  useEffect(() => {
    focusInput();
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForQuickCaptureShown(() => {
      void refetchAppState();
      focusInput();
    })
      .then((listener) => {
        if (active) {
          unlisten = listener;
        } else {
          listener();
        }
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "quick-capture-shown listener registration failed",
          cause,
        ),
      );
    return () => {
      active = false;
      unlisten?.();
    };
  }, [focusInput, refetchAppState]);

  const discardAndHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    clearDraft();
    void hideQuickCapture();
  }, [clearDraft]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForQuickCaptureCloseRequest(discardAndHide)
      .then((listener) => {
        if (active) unlisten = listener;
        else listener();
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "Quick Capture shortcut close listener registration failed",
          cause,
        ),
      );
    return () => {
      active = false;
      unlisten?.();
    };
  }, [discardAndHide]);

  useEffect(() => {
    let active = true;
    let unlistenClose: (() => void) | undefined;
    let unlistenMove: (() => void) | undefined;
    let positionTimer: number | null = null;

    void listenForCurrentWindowClose(discardAndHide)
      .then((listener) => {
        if (active) unlistenClose = listener;
        else listener();
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "Quick Capture close listener registration failed",
          cause,
        ),
      );
    void listenForCurrentWindowMove(() => {
      if (positionTimer !== null) window.clearTimeout(positionTimer);
      positionTimer = window.setTimeout(() => {
        void saveQuickCapturePosition();
      }, POSITION_DEBOUNCE_MS);
    })
      .then((listener) => {
        if (active) unlistenMove = listener;
        else listener();
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "Quick Capture move listener registration failed",
          cause,
        ),
      );

    return () => {
      active = false;
      if (positionTimer !== null) window.clearTimeout(positionTimer);
      unlistenClose?.();
      unlistenMove?.();
    };
  }, [discardAndHide]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForDebugReloadRequest(() => {
      if (useQuickCaptureStore.getState().draft.length > 0) {
        setPhase("error", t("reloadBlocked", { ns: "quick-capture" }));
        return;
      }
      window.location.reload();
    })
      .then((listener) => {
        if (active) unlisten = listener;
        else listener();
      })
      .catch((cause: unknown) =>
        logFrontendError("debug reload listener registration failed", cause),
      );
    return () => {
      active = false;
      unlisten?.();
    };
  }, [setPhase, t]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (projectMenuOpen) {
          setProjectMenuOpen(false);
          projectSelectorTriggerRef.current?.focus();
          return;
        }
        discardAndHide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [discardAndHide, projectMenuOpen]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!projectSelectorRef.current?.contains(event.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [projectMenuOpen]);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    [],
  );

  const disabledReason = useMemo(() => {
    if (selectedProject === undefined) return t("selectProject");
    if (selectedProject.state === "readOnly") return t("readOnly");
    if (selectedProject.state === "unavailable") return t("unavailable");
    return null;
  }, [selectedProject, t]);
  const canCapture =
    selectedProject !== undefined &&
    disabledReason === null &&
    phase !== "saving" &&
    phase !== "saved";

  const submit = useCallback(async () => {
    if (!canCapture || selectedProject === undefined) return;
    setPhase("saving");
    try {
      const result = await capture.mutateAsync({
        projectPath: selectedProject.path,
        content: draft,
      });
      setPhase(
        "saved",
        result.preferenceWarning === null ? null : t("preferenceWarning"),
      );
      hideTimerRef.current = window.setTimeout(() => {
        clearDraft();
        void hideQuickCapture();
      }, SUCCESS_DELAY_MS);
    } catch {
      setPhase("error", t("captureFailed"));
    }
  }, [canCapture, capture, clearDraft, draft, selectedProject, setPhase, t]);

  const addFirstProject = async () => {
    const path = await selectProjectDirectory(t("addProject"));
    if (path === null) return;
    try {
      const next = await addProject.mutateAsync(path);
      setSelectedProjectPath(next.lastSelectedProject);
      focusInput();
    } catch (cause) {
      if (import.meta.env.DEV) console.error("add project", cause);
      setPhase("error", t("addProjectFailed"));
    }
  };

  return (
    <main
      className="grid h-full w-full grid-rows-[44px_minmax(0,1fr)_48px] overflow-hidden rounded-2xl bg-surface text-foreground"
      onPointerEnter={focusPanelOnPointerEnter}
    >
      <header
        className="flex min-w-0 items-center gap-2 px-[7px] pl-3"
        data-tauri-drag-region
      >
        <h1
          className="m-0 text-base font-semibold leading-[22px]"
          data-tauri-drag-region
        >
          {t("title")}
        </h1>
        <div className="h-full min-w-6 flex-1" data-tauri-drag-region />
        <IconButton
          icon={X}
          label={t("close")}
          onClick={discardAndHide}
          size={15}
        />
      </header>

      <section className="relative min-h-0 p-3">
        {projects.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 text-muted-foreground">
            <p className="m-0">{t("empty")}</p>
            <Button
              onClick={() => void addFirstProject()}
              size="sm"
              variant="outline"
            >
              <FolderPlus size={15} />
              {t("addProject")}
            </Button>
          </div>
        ) : (
          <Textarea
            ref={inputRef}
            aria-label={t("contentLabel")}
            className={cn(
              "h-full w-full resize-none border-0 bg-transparent p-0 leading-5 shadow-none focus-visible:ring-0",
              error !== null && "pb-6 pr-[104px]",
            )}
            placeholder={t("placeholder")}
            value={draft}
            disabled={phase === "saved"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.metaKey &&
                event.key === "Enter" &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
          />
        )}
        {error === null ? null : (
          <div
            className="pointer-events-none absolute bottom-2.5 right-3 max-w-[calc(100%_-_24px)] truncate text-xs leading-[17px] text-destructive"
            role="status"
          >
            {error}
          </div>
        )}
      </section>

      <footer className="flex items-center justify-between gap-3 py-2 pl-3 pr-[9px]">
        <div className="relative w-[180px] min-w-0" ref={projectSelectorRef}>
          <Button
            ref={projectSelectorTriggerRef}
            className="w-full min-w-0 justify-start gap-1.5 px-[7px] text-muted-foreground hover:text-foreground aria-expanded:border-input aria-expanded:bg-accent"
            variant="ghost"
            size="sm"
            type="button"
            role="combobox"
            aria-controls="quick-capture-project-menu"
            aria-expanded={projectMenuOpen}
            aria-label={t("project")}
            title={projectSelectorTitle(selectedProject, disabledReason)}
            disabled={
              projects.length === 0 || phase === "saving" || phase === "saved"
            }
            onClick={() => setProjectMenuOpen((open) => !open)}
          >
            {selectedProject?.state === "writable" ? (
              <Folder size={14} />
            ) : selectedProject === undefined ? (
              <Folder size={14} />
            ) : (
              <CircleAlert className="shrink-0 text-warning" size={14} />
            )}
            <span className="min-w-0 flex-1 truncate text-left text-foreground">
              {selectedProject?.name ?? t("noProjects")}
            </span>
            <ChevronDown className="shrink-0 text-muted-foreground" size={13} />
          </Button>
          {projectMenuOpen ? (
            <div
              className="absolute bottom-[calc(100%_+_6px)] left-0 z-20 flex max-h-[184px] w-[248px] flex-col gap-0.5 overflow-y-auto rounded-lg border border-input bg-elevated p-1 shadow-overlay"
              id="quick-capture-project-menu"
              role="listbox"
              aria-label={t("project")}
            >
              {projects.map((project) => {
                const isSelected = project.path === selectedProjectPath;
                const stateLabel = projectOptionLabel(
                  project,
                  t("projectState.readOnly", { ns: "common" }),
                  t("projectState.unavailable", { ns: "common" }),
                );
                return (
                  <Button
                    className="min-h-[30px] w-full min-w-0 justify-start gap-[7px] px-[7px] py-[5px] aria-selected:bg-accent"
                    key={project.path}
                    size="sm"
                    type="button"
                    variant="ghost"
                    role="option"
                    aria-selected={isSelected}
                    title={project.path}
                    onClick={() => {
                      setSelectedProjectPath(project.path);
                      setProjectMenuOpen(false);
                      focusInput();
                    }}
                  >
                    {project.state === "writable" ? (
                      <Folder size={14} />
                    ) : (
                      <CircleAlert
                        className="shrink-0 text-warning"
                        size={14}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-left">
                      {stateLabel}
                    </span>
                    {isSelected ? <Check size={14} strokeWidth={2.5} /> : null}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
        <Button
          className={cn(
            "min-w-[112px] gap-2 border-brand/40 bg-brand-subtle text-brand-foreground shadow-control hover:border-brand/60 hover:bg-brand/15 hover:text-brand-foreground",
            phase === "saved" &&
              "bg-status-done text-destructive-foreground opacity-100 hover:bg-status-done",
            (phase === "saving" || phase === "saved") && "disabled:opacity-100",
          )}
          size="sm"
          variant="outline"
          type="button"
          aria-label={
            phase === "saving"
              ? t("saving")
              : phase === "saved"
                ? t("saved")
                : t("capture")
          }
          disabled={!canCapture}
          onClick={() => void submit()}
        >
          {phase === "saving" ? (
            <>
              <span
                className="size-[13px] animate-spin rounded-full border border-current/30 border-t-current"
                aria-hidden="true"
              />
              {t("saving")}
            </>
          ) : phase === "saved" ? (
            <>
              <Check size={14} strokeWidth={2.5} />
              {t("saved")}
            </>
          ) : (
            <>
              <span>{t("capture")}</span>
              <ShortcutHint divided shortcut={t("shortcutHint")} tone="brand" />
            </>
          )}
        </Button>
      </footer>
    </main>
  );
}

function projectSelectorTitle(
  project: ProjectDto | undefined,
  disabledReason: string | null,
): string | undefined {
  if (project === undefined) return undefined;
  return [project.name, disabledReason, project.path]
    .filter(Boolean)
    .join("\n");
}

function projectOptionLabel(
  project: ProjectDto,
  readOnlyLabel: string,
  unavailableLabel: string,
): string {
  if (project.state === "readOnly") return `${project.name} — ${readOnlyLabel}`;
  if (project.state === "unavailable")
    return `${project.name} — ${unavailableLabel}`;
  return project.name;
}
