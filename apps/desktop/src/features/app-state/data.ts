import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { logFrontendError } from "../../shared/diagnostics/logger";
import { getAppState, setPanelPreferences } from "../../shared/tauri/commands";
import { listenForAppStateInvalidation } from "../../shared/tauri/events";
import type {
  AppStateDto,
  PanelPreferencesDto,
} from "../../shared/tauri/types";
import type { QueryClient } from "@tanstack/react-query";

export const appStateKey = ["app-state"] as const;

export function useAppStateQuery() {
  return useQuery({ queryKey: appStateKey, queryFn: getAppState });
}

export function setAppStateCache(
  queryClient: QueryClient,
  appState: AppStateDto,
): void {
  queryClient.setQueryData(appStateKey, appState);
}

export function usePanelPreferencesMutation() {
  return useMutation({
    mutationFn: (preferences: PanelPreferencesDto) =>
      setPanelPreferences(preferences),
  });
}

export function useAppStateInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForAppStateInvalidation(() => {
      void queryClient.invalidateQueries({ queryKey: appStateKey });
    })
      .then((listener) => {
        if (active) unlisten = listener;
        else listener();
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "app-state invalidation listener registration failed",
          cause,
        ),
      );
    return () => {
      active = false;
      unlisten?.();
    };
  }, [queryClient]);
}
