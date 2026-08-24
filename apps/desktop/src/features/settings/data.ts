import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { integrationsKey } from "../integrations/data";
import { logFrontendError } from "../../shared/diagnostics/logger";
import {
  applyThemePreference,
  themeSettingsKey,
} from "../../shared/theme/theme";
import {
  getLocaleSettings,
  getSettings,
  getThemeSettings,
  setGlobalShortcut,
  setLaunchAtLogin,
  setLocalePreference,
  setThemePreference,
} from "../../shared/tauri/commands";
import {
  listenForIntegrationsInvalidation,
  listenForSettingsInvalidation,
} from "../../shared/tauri/events";
import type {
  LanguagePreference,
  ShortcutSpecDto,
  ThemePreference,
} from "../../shared/tauri/types";

export const settingsKeys = {
  settings: ["settings"] as const,
  locale: ["locale-settings"] as const,
  theme: themeSettingsKey,
};

export function useSettingsQuery() {
  return useQuery({ queryKey: settingsKeys.settings, queryFn: getSettings });
}

export function useLocaleSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.locale,
    queryFn: getLocaleSettings,
  });
}

export function useSetLocalePreferenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preference: LanguagePreference) =>
      setLocalePreference(preference),
    onSuccess: (localeSettings) =>
      queryClient.setQueryData(settingsKeys.locale, localeSettings),
  });
}

export function useThemeSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.theme,
    queryFn: getThemeSettings,
  });
}

export function useSetThemePreferenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preference: ThemePreference) => setThemePreference(preference),
    onSuccess: async (themeSettings) => {
      queryClient.setQueryData(settingsKeys.theme, themeSettings);
      await applyThemePreference(themeSettings.preference);
    },
  });
}

export function useSetGlobalShortcutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shortcut: ShortcutSpecDto) => setGlobalShortcut(shortcut),
    onSuccess: (settings) =>
      queryClient.setQueryData(settingsKeys.settings, settings),
  });
}

export function useSetLaunchAtLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setLaunchAtLogin(enabled),
    onSuccess: (settings) =>
      queryClient.setQueryData(settingsKeys.settings, settings),
  });
}

export function useSettingsInvalidation(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const listeners: Array<() => void> = [];
    void Promise.all([
      listenForSettingsInvalidation(() => {
        void queryClient.invalidateQueries({
          queryKey: settingsKeys.settings,
        });
        void queryClient.invalidateQueries({ queryKey: settingsKeys.locale });
      }),
      listenForIntegrationsInvalidation(() => {
        void queryClient.invalidateQueries({ queryKey: integrationsKey });
      }),
    ])
      .then((unlisteners) => {
        if (active) listeners.push(...unlisteners);
        else unlisteners.forEach((unlisten) => unlisten());
      })
      .catch((cause: unknown) =>
        logFrontendError(
          "settings invalidation listener registration failed",
          cause,
        ),
      );
    return () => {
      active = false;
      listeners.forEach((unlisten) => unlisten());
    };
  }, [queryClient]);
}
