import { Check, FolderPlus, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

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
import {
  listenForDebugReloadRequest,
  listenForQuickCaptureShown,
} from "../../shared/tauri/events";
import { logFrontendError } from "../../shared/diagnostics/logger";
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
    <main className="quick-capture-shell">
      <header className="quick-capture-titlebar" data-tauri-drag-region>
        <label className="project-selector-label">
          <span className="sr-only">{t("project")}</span>
          <select
            aria-label={t("project")}
            value={selectedProjectPath ?? ""}
            onChange={(event) => setSelectedProjectPath(event.target.value)}
            disabled={projects.length === 0 || phase === "saving"}
          >
            {projects.length === 0 ? (
              <option value="">{t("noProjects")}</option>
            ) : null}
            {projects.map((project) => (
              <option key={project.path} value={project.path}>
                {projectOptionLabel(
                  project,
                  t("projectState.readOnly", { ns: "common" }),
                  t("projectState.unavailable", { ns: "common" }),
                )}
              </option>
            ))}
          </select>
        </label>
        <div className="quick-capture-drag-space" data-tauri-drag-region />
        <IconButton
          className="quick-capture-close"
          icon={X}
          label={t("close")}
          onClick={discardAndHide}
          size={15}
        />
      </header>

      <section className="quick-capture-editor">
        {projects.length === 0 ? (
          <div className="quick-capture-empty">
            <p>{t("empty")}</p>
            <button type="button" onClick={() => void addFirstProject()}>
              <FolderPlus size={15} />
              {t("addProject")}
            </button>
          </div>
        ) : (
          <textarea
            ref={inputRef}
            aria-label={t("contentLabel")}
            placeholder={t("placeholder")}
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
          {disabledReason ?? error ?? (phase === "saving" ? t("saving") : null)}
          {phase === "saved" ? (
            <span className="saved-feedback">
              <Check size={14} weight="bold" />
              {t("saved")}
            </span>
          ) : null}
        </div>
        {phase === "error" ? (
          <button
            className="quick-capture-retry"
            type="button"
            onClick={() => void submit()}
          >
            {t("retry")}
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
          {t("capture")}
        </button>
      </footer>
    </main>
  );
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
