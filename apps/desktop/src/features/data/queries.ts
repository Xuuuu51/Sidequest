import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { queryKeys } from "../../shared/query/keys";
import {
  addProject,
  createQuest,
  deleteQuest,
  getAppState,
  loadWorkspace,
  relocateProject,
  removeProject,
  searchQuests,
  setLastSelectedProject,
  setPanelPreferences,
  setQuestStatus,
  updateQuestContent,
} from "../../shared/tauri/commands";
import type {
  AppStateDto,
  PanelPreferencesDto,
  QuestDto,
  QuestStatus,
  WorkspaceSnapshotDto,
} from "../../shared/tauri/types";

export function useAppStateQuery() {
  return useQuery({
    queryKey: queryKeys.appState,
    queryFn: getAppState,
  });
}

export function useWorkspaceQuery(projectPath: string | null) {
  return useQuery({
    queryKey: queryKeys.workspace(projectPath ?? ""),
    queryFn: () => loadWorkspace(requiredProjectPath(projectPath)),
    enabled: projectPath !== null,
  });
}

export function useSearchQuery(projectPath: string | null, query: string) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: queryKeys.search(projectPath ?? "", normalizedQuery),
    queryFn: () =>
      searchQuests(requiredProjectPath(projectPath), normalizedQuery),
    enabled: projectPath !== null && normalizedQuery.length > 0,
  });
}

export function useAddProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addProject,
    onSuccess: (appState) => setAppState(queryClient, appState),
  });
}

export function useRemoveProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => removeProject(projectPath),
    onSuccess: (appState, projectPath) => {
      setAppState(queryClient, appState);
      queryClient.removeQueries({ queryKey: queryKeys.workspace(projectPath) });
      queryClient.removeQueries({ queryKey: ["search", projectPath] });
    },
  });
}

export function useSelectProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setLastSelectedProject,
    onSuccess: (appState) => setAppState(queryClient, appState),
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
      setAppState(queryClient, appState);
      queryClient.removeQueries({ queryKey: queryKeys.workspace(projectPath) });
      queryClient.removeQueries({ queryKey: ["search", projectPath] });
    },
  });
}

export function usePanelPreferencesMutation() {
  return useMutation({
    mutationFn: (preferences: PanelPreferencesDto) =>
      setPanelPreferences(preferences),
  });
}

export function useCreateQuestMutation(projectPath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createQuest(projectPath, content),
    onSuccess: async () => invalidateProjectData(queryClient, projectPath),
  });
}

export function useUpdateQuestContentMutation(projectPath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      updateQuestContent(projectPath, id, content),
    scope: { id: questMutationScope(projectPath, id) },
    onSuccess: (quest) => {
      replaceCachedQuest(queryClient, projectPath, quest);
      void queryClient.invalidateQueries({
        queryKey: ["search", projectPath],
      });
    },
  });
}

export function useSetQuestStatusMutation(projectPath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: QuestStatus) =>
      setQuestStatus(projectPath, id, status),
    scope: { id: questMutationScope(projectPath, id) },
    onSuccess: (quest) => {
      replaceCachedQuest(queryClient, projectPath, quest);
      void queryClient.invalidateQueries({
        queryKey: ["search", projectPath],
      });
    },
  });
}

export function useSetDraggedQuestStatusMutation(projectPath: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (id: string, status: QuestStatus) => {
      const mutation = queryClient.getMutationCache().build(queryClient, {
        mutationFn: () => setQuestStatus(projectPath, id, status),
        scope: { id: questMutationScope(projectPath, id) },
        onSuccess: (quest: QuestDto) => {
          replaceCachedQuest(queryClient, projectPath, quest);
          void queryClient.invalidateQueries({
            queryKey: ["search", projectPath],
          });
        },
      });
      return mutation.execute(undefined);
    },
    [projectPath, queryClient],
  );
}

export function useDeleteQuestMutation(projectPath: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteQuest(projectPath, id),
    scope: { id: questMutationScope(projectPath, id) },
    onSuccess: () => {
      queryClient.setQueryData<WorkspaceSnapshotDto>(
        queryKeys.workspace(projectPath),
        (snapshot) =>
          snapshot === undefined
            ? undefined
            : {
                ...snapshot,
                quests: snapshot.quests.filter((quest) => quest.id !== id),
              },
      );
      void queryClient.invalidateQueries({
        queryKey: ["search", projectPath],
      });
    },
  });
}

function requiredProjectPath(projectPath: string | null): string {
  if (projectPath === null) {
    throw new Error("A selected project is required");
  }
  return projectPath;
}

function setAppState(queryClient: QueryClient, appState: AppStateDto): void {
  queryClient.setQueryData(queryKeys.appState, appState);
}

function replaceCachedQuest(
  queryClient: QueryClient,
  projectPath: string,
  quest: QuestDto,
): void {
  queryClient.setQueryData<WorkspaceSnapshotDto>(
    queryKeys.workspace(projectPath),
    (snapshot) =>
      snapshot === undefined
        ? undefined
        : {
            ...snapshot,
            quests: snapshot.quests.map((existing) =>
              existing.id === quest.id ? quest : existing,
            ),
          },
  );
}

async function invalidateProjectData(
  queryClient: QueryClient,
  projectPath: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.workspace(projectPath),
    }),
    queryClient.invalidateQueries({ queryKey: ["search", projectPath] }),
  ]);
}

function questMutationScope(projectPath: string, id: string): string {
  return `quest:${projectPath}:${id}`;
}
