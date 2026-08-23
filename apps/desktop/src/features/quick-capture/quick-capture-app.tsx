import { Check, FolderPlus, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  useAddProjectMutation,
  useAppStateQuery,
  useCaptureQuestMutation,
} from "../data/queries";
import { useAppStateInvalidation } from "../data/use-app-state-invalidation";
import {
  hideQuickCapture,
  saveQuickCapturePosition,
  selectProjectDirectory,
} from "../../shared/tauri/commands";
import { listenForQuickCaptureShown } from "../../shared/tauri/events";
import type { ProjectDto } from "../../shared/tauri/types";
import {
  listenForCurrentWindowClose,
  listenForCurrentWindowMove,
} from "../../shared/tauri/window";
import { IconButton } from "../../shared/ui/icon-button";
import { useQuickCaptureStore } from "../../store/quick-capture";
import "./quick-capture.css";

const SUCCESS_DELAY_MS = 500;
const POSITION_DEBOUNCE_MS = 250;

export function QuickCaptureApp() {
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
  const hideTimerRef = useRef<number | null>(null);
  const refetchAppState = appState.refetch;

  const projects = appState.data?.projects ?? [];
  const selectedProject = projects.find(
    (project) => project.path === selectedProjectPath,
  );

  useEffect(() => {
    if (appState.data === undefined) {
      return;
    }
    const currentStillExists = appState.data.projects.some(
      (project) => project.path === selectedProjectPath,
    );
    if (!currentStillExists) {
      setSelectedProjectPath(appState.data.quickCapture.lastProjectPath);
    }
  }, [appState.data, selectedProjectPath, setSelectedProjectPath]);

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    focusInput();
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForQuickCaptureShown(() => {
      void refetchAppState();
      focusInput();
    }).then((listener) => {
      if (active) {
        unlisten = listener;
      } else {
        listener();
      }
    });
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
    let unlistenClose: (() => void) | undefined;
    let unlistenMove: (() => void) | undefined;
    let positionTimer: number | null = null;

    void listenForCurrentWindowClose(discardAndHide).then((listener) => {
      if (active) unlistenClose = listener;
      else listener();
    });
    void listenForCurrentWindowMove(() => {
      if (positionTimer !== null) window.clearTimeout(positionTimer);
      positionTimer = window.setTimeout(() => {
        void saveQuickCapturePosition();
      }, POSITION_DEBOUNCE_MS);
    }).then((listener) => {
      if (active) unlistenMove = listener;
      else listener();
    });

    return () => {
      active = false;
      if (positionTimer !== null) window.clearTimeout(positionTimer);
      unlistenClose?.();
      unlistenMove?.();
    };
  }, [discardAndHide]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        discardAndHide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [discardAndHide]);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    [],
  );

  const disabledReason = useMemo(
    () => projectDisabledReason(selectedProject),
    [selectedProject],
  );
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
        result.preferenceWarning === null
          ? null
          : "Saved, but the project preference could not be remembered.",
      );
      hideTimerRef.current = window.setTimeout(() => {
        clearDraft();
        void hideQuickCapture();
      }, SUCCESS_DELAY_MS);
    } catch (cause) {
      setPhase(
        "error",
        cause instanceof Error
          ? cause.message
          : "Could not capture this Quest.",
      );
    }
  }, [canCapture, capture, clearDraft, draft, selectedProject, setPhase]);

  const addFirstProject = async () => {
    const path = await selectProjectDirectory();
    if (path === null) return;
    try {
      const next = await addProject.mutateAsync(path);
      setSelectedProjectPath(next.lastSelectedProject);
      focusInput();
    } catch (cause) {
      setPhase(
        "error",
        cause instanceof Error ? cause.message : "Could not add this project.",
      );
    }
  };

  return (
    <main className="quick-capture-shell">
      <header className="quick-capture-titlebar" data-tauri-drag-region>
        <label className="project-selector-label">
          <span className="sr-only">Project</span>
          <select
            aria-label="Project"
            value={selectedProjectPath ?? ""}
            onChange={(event) => setSelectedProjectPath(event.target.value)}
            disabled={projects.length === 0 || phase === "saving"}
          >
            {projects.length === 0 ? (
              <option value="">No projects</option>
            ) : null}
            {projects.map((project) => (
              <option key={project.path} value={project.path}>
                {projectOptionLabel(project)}
              </option>
            ))}
          </select>
        </label>
        <div className="quick-capture-drag-space" data-tauri-drag-region />
        <IconButton
          className="quick-capture-close"
          icon={X}
          label="Close Quick Capture"
          onClick={discardAndHide}
          size={15}
        />
      </header>

      <section className="quick-capture-editor">
        {projects.length === 0 ? (
          <div className="quick-capture-empty">
            <p>Add a project before capturing your first Quest.</p>
            <button type="button" onClick={() => void addFirstProject()}>
              <FolderPlus size={15} />
              Add Project…
            </button>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            aria-label="Quest content"
            placeholder="What needs attention?"
            value={draft}
            disabled={disabledReason !== null || phase === "saved"}
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
      </section>

      <footer className="quick-capture-footer">
        <div className="quick-capture-feedback" role="status">
          {disabledReason ?? error ?? (phase === "saving" ? "Saving…" : null)}
          {phase === "saved" ? (
            <span className="saved-feedback">
              <Check size={14} weight="bold" /> Saved
            </span>
          ) : null}
        </div>
        {phase === "error" ? (
          <button
            className="quick-capture-retry"
            type="button"
            onClick={() => void submit()}
          >
            Retry
          </button>
        ) : null}
        <span className="quick-capture-shortcut">
          <kbd>⌘↵</kbd>
        </span>
        <button
          className="quick-capture-submit"
          type="button"
          disabled={!canCapture}
          onClick={() => void submit()}
        >
          Capture
        </button>
      </footer>
    </main>
  );
}

function projectDisabledReason(project: ProjectDto | undefined): string | null {
  if (project === undefined) return "Select a project";
  if (project.state === "readOnly") return "This project is read-only";
  if (project.state === "unavailable") return "This project is unavailable";
  return null;
}

function projectOptionLabel(project: ProjectDto): string {
  if (project.state === "readOnly") return `${project.name} — Read Only`;
  if (project.state === "unavailable") return `${project.name} — Unavailable`;
  return project.name;
}
