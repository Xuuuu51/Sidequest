import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import {
  completeAppQuit,
  hideMainWindow,
  saveMainWindowGeometry,
} from "../../shared/tauri/commands";
import { listenForAppQuitRequest } from "../../shared/tauri/events";
import type { NavigationIntent } from "../../store/main-window";

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
    const window = getCurrentWindow();
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

    const subscriptions = Promise.all([
      window.onMoved(scheduleSave),
      window.onResized(scheduleSave),
      window.onCloseRequested(async (event) => {
        event.preventDefault();
        if (timeout !== null) {
          clearTimeout(timeout);
          timeout = null;
        }
        await guard(async () => {
          await saveMainWindowGeometry();
          await hideMainWindow();
        }, "hide");
      }),
      listenForAppQuitRequest(() => {
        void guard(completeAppQuit, "quit");
      }),
    ]);

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
