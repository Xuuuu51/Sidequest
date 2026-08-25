import { useEffect } from "react";

import {
  completeAppQuit,
  hideMainWindow,
  saveMainWindowGeometry,
} from "../../shared/tauri/commands";
import {
  listenForAppQuitRequest,
  listenForHideMainWindowRequest,
} from "../../shared/tauri/events";
import type { NavigationIntent } from "../../store/main-window/types";
import { logFrontendError } from "../../shared/diagnostics/logger";
import {
  listenForCurrentWindowClose,
  listenForCurrentWindowMove,
  listenForCurrentWindowResize,
} from "../../shared/tauri/window";

const SAVE_DELAY_MS = 300;

type NavigationGuard = (
  action: () => void | Promise<void>,
  intent?: NavigationIntent,
) => Promise<boolean>;

const immediateGuard: NavigationGuard = async (action) => {
  await action();
  return true;
};

export function useWindowGeometryPersistence(
  guard: NavigationGuard = immediateGuard,
): void {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    const scheduleSave = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        timeout = null;
        void saveMainWindowGeometry();
      }, SAVE_DELAY_MS);
    };
    const requestHide = () => {
      if (timeout !== null) {
        clearTimeout(timeout);
        timeout = null;
      }
      void guard(async () => {
        await saveMainWindowGeometry();
        await hideMainWindow();
      }, "hide");
    };

    const subscriptions = Promise.all([
      listenForCurrentWindowMove(scheduleSave),
      listenForCurrentWindowResize(scheduleSave),
      listenForCurrentWindowClose(requestHide),
      listenForHideMainWindowRequest(requestHide),
      listenForAppQuitRequest(() => {
        void guard(completeAppQuit, "quit");
      }),
    ]).catch((cause: unknown) => {
      logFrontendError("window lifecycle listener registration failed", cause);
      return [];
    });

    return () => {
      disposed = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      void subscriptions.then((unlisteners) => {
        if (disposed) {
          unlisteners.forEach((unlisten) => unlisten());
        }
      });
    };
  }, [guard]);
}
