import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { WorkspaceInvalidatedDto } from "./types";

export const WORKSPACE_INVALIDATED_EVENT = "workspace-invalidated";

export function listenForWorkspaceInvalidation(
  handler: (payload: WorkspaceInvalidatedDto) => void,
): Promise<UnlistenFn> {
  return listen<WorkspaceInvalidatedDto>(WORKSPACE_INVALIDATED_EVENT, (event) =>
    handler(event.payload),
  );
}
