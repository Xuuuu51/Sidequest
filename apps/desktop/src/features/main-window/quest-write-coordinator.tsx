import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useUpdateQuestContentMutation } from "../data/queries";
import { useMainWindowStore } from "../../store/main-window";
import type { NavigationIntent } from "../../store/main-window";

const AUTO_SAVE_DELAY_MS = 500;
const SAVED_FEEDBACK_MS = 1200;

interface QuestWriteCoordinatorValue {
  flush: () => Promise<boolean>;
  guard: (
    action: () => void | Promise<void>,
    intent?: NavigationIntent,
  ) => Promise<boolean>;
  retrySave: () => Promise<boolean>;
  discardLocalChanges: () => Promise<void>;
  cancelNavigation: () => void;
  overwriteConflict: () => Promise<boolean>;
}

const QuestWriteCoordinatorContext =
  createContext<QuestWriteCoordinatorValue | null>(null);

export function QuestWriteCoordinatorProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const editor = useMainWindowStore((state) => state.editor);
  const deleteConfirming = useMainWindowStore(
    (state) => state.deleteConfirming,
  );
  const beginSaving = useMainWindowStore((state) => state.beginSaving);
  const completeSaving = useMainWindowStore((state) => state.completeSaving);
  const failSaving = useMainWindowStore((state) => state.failSaving);
  const clearSavedFeedback = useMainWindowStore(
    (state) => state.clearSavedFeedback,
  );
  const loadDiskContent = useMainWindowStore((state) => state.loadDiskContent);
  const setNavigationPending = useMainWindowStore(
    (state) => state.setNavigationPending,
  );
  const updateContent = useUpdateQuestContentMutation(
    editor?.projectPath ?? "",
    editor?.questId ?? "",
  );
  const mutateContent = updateContent.mutateAsync;
  const pendingAction = useRef<(() => void | Promise<void>) | null>(null);
  const savePromise = useRef<Promise<boolean> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSave = useCallback(
    async (allowRecoveryState: boolean): Promise<boolean> => {
      if (savePromise.current !== null) {
        return savePromise.current;
      }
      const state = useMainWindowStore.getState();
      const current = state.editor;
      if (current === null || current.draftContent === current.baseContent) {
        return true;
      }
      if (
        !allowRecoveryState &&
        (current.phase === "saveError" || current.phase === "externalConflict")
      ) {
        return false;
      }

      const content = current.draftContent;
      beginSaving();
      const promise = mutateContent(content)
        .then((quest) => {
          const latest = useMainWindowStore.getState().editor;
          if (
            latest === null ||
            latest.projectPath !== current.projectPath ||
            latest.questId !== current.questId
          ) {
            return false;
          }
          completeSaving(quest.content);
          if (savedTimer.current !== null) {
            clearTimeout(savedTimer.current);
          }
          savedTimer.current = setTimeout(
            () => clearSavedFeedback(),
            SAVED_FEEDBACK_MS,
          );
          return true;
        })
        .catch((error: unknown) => {
          failSaving(toError(error).message);
          return false;
        })
        .finally(() => {
          savePromise.current = null;
        });
      savePromise.current = promise;
      return promise;
    },
    [
      beginSaving,
      clearSavedFeedback,
      completeSaving,
      failSaving,
      mutateContent,
    ],
  );

  const flush = useCallback(async () => performSave(false), [performSave]);

  const runPendingAction = useCallback(async () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setNavigationPending(false);
    await action?.();
  }, [setNavigationPending]);

  const guard = useCallback(
    async (
      action: () => void | Promise<void>,
      intent: NavigationIntent = "navigation",
    ): Promise<boolean> => {
      const current = useMainWindowStore.getState().editor;
      if (current === null || current.draftContent === current.baseContent) {
        await action();
        return true;
      }
      if (pendingAction.current !== null) {
        return false;
      }
      pendingAction.current = action;
      setNavigationPending(true, intent);
      const saved = await flush();
      if (saved) {
        await runPendingAction();
      }
      return saved;
    },
    [flush, runPendingAction, setNavigationPending],
  );

  const retrySave = useCallback(async () => {
    const saved = await performSave(true);
    if (saved && pendingAction.current !== null) {
      await runPendingAction();
    }
    return saved;
  }, [performSave, runPendingAction]);

  const discardLocalChanges = useCallback(async () => {
    const current = useMainWindowStore.getState().editor;
    if (current !== null) {
      loadDiskContent(current.baseContent);
    }
    if (pendingAction.current !== null) {
      await runPendingAction();
    }
  }, [loadDiskContent, runPendingAction]);

  const cancelNavigation = useCallback(() => {
    pendingAction.current = null;
    setNavigationPending(false);
  }, [setNavigationPending]);

  const overwriteConflict = useCallback(
    async () => performSave(true),
    [performSave],
  );

  useEffect(() => {
    if (editor?.phase !== "pending" || deleteConfirming) {
      return;
    }
    const timeout = setTimeout(() => void flush(), AUTO_SAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [deleteConfirming, editor?.draftContent, editor?.phase, flush]);

  useEffect(
    () => () => {
      if (savedTimer.current !== null) {
        clearTimeout(savedTimer.current);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      flush,
      guard,
      retrySave,
      discardLocalChanges,
      cancelNavigation,
      overwriteConflict,
    }),
    [
      cancelNavigation,
      discardLocalChanges,
      flush,
      guard,
      overwriteConflict,
      retrySave,
    ],
  );

  return (
    <QuestWriteCoordinatorContext.Provider value={value}>
      {children}
    </QuestWriteCoordinatorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook and provider share one context boundary.
export function useQuestWriteCoordinator(): QuestWriteCoordinatorValue {
  const coordinator = useContext(QuestWriteCoordinatorContext);
  if (coordinator === null) {
    throw new Error("QuestWriteCoordinatorProvider is required");
  }
  return coordinator;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return new Error(value.message);
  }
  return new Error(String(value));
}
