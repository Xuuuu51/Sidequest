export const queryKeys = {
  appState: ["app-state"] as const,
  workspace: (projectPath: string) => ["workspace", projectPath] as const,
  search: (projectPath: string, query: string) =>
    ["search", projectPath, query] as const,
  settings: ["settings"] as const,
  localeSettings: ["locale-settings"] as const,
  integrations: ["integrations"] as const,
};
