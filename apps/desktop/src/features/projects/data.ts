import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setAppStateCache } from "../app-state/data";
import { workspaceKeys } from "../workspace/data";
import {
  addProject,
  relocateProject,
  removeProject,
  setLastSelectedProject,
} from "../../shared/tauri/commands";

export function useAddProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addProject,
    onSuccess: (appState) => setAppStateCache(queryClient, appState),
  });
}

export function useRemoveProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => removeProject(projectPath),
    onSuccess: (appState, projectPath) => {
      setAppStateCache(queryClient, appState);
      queryClient.removeQueries({
        queryKey: workspaceKeys.snapshot(projectPath),
      });
      queryClient.removeQueries({
        queryKey: workspaceKeys.searchRoot(projectPath),
      });
    },
  });
}

export function useSelectProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setLastSelectedProject,
    onSuccess: (appState) => setAppStateCache(queryClient, appState),
  });
}

export function useRelocateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectPath,
      replacementPath,
    }: {
      projectPath: string;
      replacementPath: string;
    }) => relocateProject(projectPath, replacementPath),
    onSuccess: (appState, { projectPath }) => {
      setAppStateCache(queryClient, appState);
      queryClient.removeQueries({
        queryKey: workspaceKeys.snapshot(projectPath),
      });
      queryClient.removeQueries({
        queryKey: workspaceKeys.searchRoot(projectPath),
      });
    },
  });
}
