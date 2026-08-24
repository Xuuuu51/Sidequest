import { useEffect } from "react";

import { listenForLocaleChange } from "../tauri/events";
import { logFrontendError } from "../diagnostics/logger";
import { i18n } from "./i18n";

export function useLocaleEvents(): void {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenForLocaleChange((locale) => {
      void i18n.changeLanguage(locale).catch((error: unknown) => {
        logFrontendError("locale change failed", error);
      });
    })
      .then((dispose) => {
        if (disposed) dispose();
        else unlisten = dispose;
      })
      .catch((error: unknown) => {
        logFrontendError("locale listener registration failed", error);
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
