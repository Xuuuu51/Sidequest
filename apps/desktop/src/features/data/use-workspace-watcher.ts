import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../shared/query/keys";
import { setWatchedProject } from "../../shared/tauri/commands";
import { listenForWorkspaceInvalidation } from "../../shared/tauri/events";
import { logDebug, logFrontendError } from "../../shared/diagnostics/logger";

const INVALIDATION_DEBOUNCE_MS = 150;

export function useWorkspaceWatcher(projectPath: string | null): Error | null {
  const queryClient = useQueryClient();
  const [watcherError, setWatcherError] = useState<Error | null>(null);

  useEffect(() => {
    let disposed = false;
    void setWatchedProject(projectPath)
      .then(() => {
        if (!disposed) {
          setWatcherError(null);
        }
      })
      .catch((error: unknown) => {
        logFrontendError("workspace watcher update failed", error);
        if (!disposed) {
          setWatcherError(toError(error));
        }
      });
    return () => {
      disposed = true;
    };
  }, [projectPath]);

  useEffect(
    () => () => {
      void setWatchedProject(null).catch((cause: unknown) =>
        logFrontendError("workspace watcher shutdown failed", cause),
      );
    },
    [],
  );

  useEffect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForWorkspaceInvalidation(({ projectPath: invalidatedPath }) => {
      const existingTimer = timers.get(invalidatedPath);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
      }
      timers.set(
        invalidatedPath,
        setTimeout(() => {
          timers.delete(invalidatedPath);
          logDebug("workspace invalidation debounce completed");
          void queryClient.invalidateQueries({
            queryKey: queryKeys.workspace(invalidatedPath),
          });
          void queryClient.invalidateQueries({
            queryKey: ["search", invalidatedPath],
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.appState,
          });
        }, INVALIDATION_DEBOUNCE_MS),
      );
    })
      .then((unsubscribe) => {
        if (disposed) {
          unsubscribe();
        } else {
          unlisten = unsubscribe;
        }
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "workspace invalidation listener registration failed",
          cause,
        ),
      );

    return () => {
      disposed = true;
      unlisten?.();
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [queryClient]);

  return watcherError;
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
