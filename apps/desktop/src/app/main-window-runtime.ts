import { useEffect } from "react";

import { useAppStateInvalidation } from "../features/app-state/data";
import { useQuestWriteCoordinator } from "../features/quests/quest-write-coordinator";
import { useSettingsInvalidation } from "../features/settings/data";
import { useWindowGeometryPersistence } from "../features/window/use-window-geometry";
import { logFrontendError } from "../shared/diagnostics/logger";
import {
  listenForDebugReloadRequest,
  listenForOpenSettings,
} from "../shared/tauri/events";
import { useMainWindowStore } from "../store/main-window/store";

export function useMainWindowRuntime(): void {
  useAppStateInvalidation();
  useSettingsInvalidation();
  const coordinator = useQuestWriteCoordinator();
  const showSettings = useMainWindowStore((state) => state.showSettings);
  useWindowGeometryPersistence(coordinator.guard);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForOpenSettings(() => {
      void coordinator.guard(async () => showSettings());
    })
      .then((listener) => {
        if (active) unlisten = listener;
        else listener();
      })
      .catch((cause: unknown) =>
        logFrontendError("open-settings listener registration failed", cause),
      );
    return () => {
      active = false;
      unlisten?.();
    };
  }, [coordinator, showSettings]);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;
    void listenForDebugReloadRequest(() => {
      void coordinator.guard(async () => window.location.reload());
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
  }, [coordinator]);
}
