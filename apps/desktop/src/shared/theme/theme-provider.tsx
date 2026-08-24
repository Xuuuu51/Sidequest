import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { logFrontendError } from "../diagnostics/logger";
import { listenForThemeChange } from "../tauri/events";
import type { EffectiveTheme, ThemePreference } from "../tauri/types";
import {
  isTauriRuntime,
  listenForCurrentWindowThemeChange,
} from "../tauri/window";
import {
  applyDocumentTheme,
  applyThemePreference,
  currentThemePreference,
  systemThemeFallback,
  themeSettingsKey,
} from "./theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const unlisteners: Array<() => void> = [];

    const register = async () => {
      if (!isTauriRuntime()) {
        const media = window.matchMedia?.("(prefers-color-scheme: dark)");
        const handleChange = () => {
          if (currentThemePreference() === "system") {
            applyDocumentTheme(systemThemeFallback());
          }
        };
        media?.addEventListener("change", handleChange);
        unlisteners.push(() =>
          media?.removeEventListener("change", handleChange),
        );
        return;
      }

      try {
        const unlisten = await listenForThemeChange((nextPreference) => {
          queryClient.setQueryData(themeSettingsKey, {
            preference: nextPreference,
          });
          void applyThemePreference(nextPreference);
        });
        if (active) unlisteners.push(unlisten);
        else unlisten();
      } catch (error) {
        logFrontendError("theme listener registration failed", error);
      }

      try {
        const unlisten = await listenForCurrentWindowThemeChange((theme) => {
          if (currentThemePreference() === "system") {
            applyDocumentTheme(theme);
          }
        });
        if (active) unlisteners.push(unlisten);
        else unlisten();
      } catch (error) {
        logFrontendError("system theme listener registration failed", error);
      }
    };

    void register();
    return () => {
      active = false;
      for (const unlisten of unlisteners) unlisten();
    };
  }, [queryClient]);

  return children;
}

export type { EffectiveTheme, ThemePreference };
