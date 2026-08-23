import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "../../shared/query/keys";
import {
  listenForIntegrationsInvalidation,
  listenForSettingsInvalidation,
} from "../../shared/tauri/events";

export function useSettingsInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const listeners: Array<() => void> = [];
    void Promise.all([
      listenForSettingsInvalidation(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      }),
      listenForIntegrationsInvalidation(() => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.integrations,
        });
      }),
    ]).then((unlisteners) => {
      if (active) listeners.push(...unlisteners);
      else unlisteners.forEach((unlisten) => unlisten());
    });
    return () => {
      active = false;
      listeners.forEach((unlisten) => unlisten());
    };
  }, [queryClient]);
}
