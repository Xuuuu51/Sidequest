import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "../../shared/query/keys";
import { listenForAppStateInvalidation } from "../../shared/tauri/events";

export function useAppStateInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForAppStateInvalidation(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appState });
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
  }, [queryClient]);
}
