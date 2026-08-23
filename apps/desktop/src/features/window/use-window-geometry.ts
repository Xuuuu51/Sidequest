import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { saveMainWindowGeometry } from "../../shared/tauri/commands";

const SAVE_DELAY_MS = 300;

export function useWindowGeometryPersistence(): void {
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
        try {
          await saveMainWindowGeometry();
        } finally {
          await window.destroy();
        }
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
  }, []);
}
