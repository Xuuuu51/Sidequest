import {
  keepPreviousData,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { appStateKey } from "../app-state/data";
import { logDebug, logFrontendError } from "../../shared/diagnostics/logger";
import {
  loadWorkspace,
  searchQuests,
  setWatchedProject,
} from "../../shared/tauri/commands";
import { listenForWorkspaceInvalidation } from "../../shared/tauri/events";

const INVALIDATION_DEBOUNCE_MS = 150;

export const workspaceKeys = {
  snapshot: (projectPath: string) => ["workspace", projectPath] as const,
  searchRoot: (projectPath: string) => ["search", projectPath] as const,
  search: (projectPath: string, query: string) =>
    ["search", projectPath, query] as const,
};

export function workspaceOptions(projectPath: string) {
  return queryOptions({
    queryKey: workspaceKeys.snapshot(projectPath),
    queryFn: () => loadWorkspace(projectPath),
  });
}

export function useWorkspaceQuery(projectPath: string | null) {
  return useQuery({
    ...workspaceOptions(projectPath ?? ""),
    enabled: projectPath !== null,
  });
}

export function useSearchQuery(projectPath: string | null, query: string) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: workspaceKeys.search(projectPath ?? "", normalizedQuery),
    queryFn: () =>
      searchQuests(requiredProjectPath(projectPath), normalizedQuery),
    enabled: projectPath !== null && normalizedQuery.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useWorkspaceWatcher(projectPath: string | null): Error | null {
  const queryClient = useQueryClient();
  const [watcherError, setWatcherError] = useState<Error | null>(null);

  useEffect(() => {
    let disposed = false;
    void setWatchedProject(projectPath)
      .then(() => {
        if (!disposed) setWatcherError(null);
      })
      .catch((error: unknown) => {
        logFrontendError("workspace watcher update failed", error);
        if (!disposed) setWatcherError(toError(error));
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
      if (existingTimer !== undefined) clearTimeout(existingTimer);
      timers.set(
        invalidatedPath,
        setTimeout(() => {
          timers.delete(invalidatedPath);
          logDebug("workspace invalidation debounce completed");
          void queryClient.invalidateQueries({
            queryKey: workspaceKeys.snapshot(invalidatedPath),
          });
          void queryClient.invalidateQueries({
            queryKey: workspaceKeys.searchRoot(invalidatedPath),
          });
          void queryClient.invalidateQueries({ queryKey: appStateKey });
        }, INVALIDATION_DEBOUNCE_MS),
      );
    })
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else unlisten = unsubscribe;
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
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, [queryClient]);

  return watcherError;
}

function requiredProjectPath(projectPath: string | null): string {
  if (projectPath === null) throw new Error("A selected project is required");
  return projectPath;
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value;
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
