import { useCallback } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { workspaceKeys } from "../workspace/data";
import {
  createQuest,
  deleteQuest,
  setQuestStatus,
  updateQuestContent,
} from "../../shared/tauri/commands";
import type {
  QuestDto,
  QuestStatus,
  WorkspaceSnapshotDto,
} from "../../shared/tauri/types";

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
        queryKey: workspaceKeys.searchRoot(projectPath),
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
        queryKey: workspaceKeys.searchRoot(projectPath),
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
        onMutate: async () => {
          await Promise.all([
            queryClient.cancelQueries({
              queryKey: workspaceKeys.snapshot(projectPath),
            }),
            queryClient.cancelQueries({
              queryKey: workspaceKeys.searchRoot(projectPath),
            }),
          ]);
          const snapshot = captureProjectCacheSnapshot(
            queryClient,
            projectPath,
          );
          optimisticallySetQuestStatus(queryClient, projectPath, id, status);
          return snapshot;
        },
        onSuccess: (quest: QuestDto) => {
          replaceQuestInProjectCaches(queryClient, projectPath, quest);
        },
        onError: (_error, _variables, context) => {
          if (context !== undefined) {
            restoreProjectCacheSnapshot(queryClient, projectPath, context);
          }
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
        workspaceKeys.snapshot(projectPath),
        (snapshot) =>
          snapshot === undefined
            ? undefined
            : {
                ...snapshot,
                quests: snapshot.quests.filter((quest) => quest.id !== id),
              },
      );
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.searchRoot(projectPath),
      });
    },
  });
}

function replaceCachedQuest(
  queryClient: QueryClient,
  projectPath: string,
  quest: QuestDto,
): void {
  queryClient.setQueryData<WorkspaceSnapshotDto>(
    workspaceKeys.snapshot(projectPath),
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

export function optimisticallySetQuestStatus(
  queryClient: QueryClient,
  projectPath: string,
  id: string,
  status: QuestStatus,
): void {
  patchQuestInSnapshot(queryClient, workspaceKeys.snapshot(projectPath), id, {
    status,
  });
  for (const [queryKey] of queryClient.getQueriesData({
    queryKey: workspaceKeys.searchRoot(projectPath),
  })) {
    patchQuestInSnapshot(queryClient, queryKey, id, { status });
  }
}

export interface ProjectCacheSnapshot {
  workspace: WorkspaceSnapshotDto | undefined;
  searches: Array<[readonly unknown[], WorkspaceSnapshotDto | undefined]>;
}

export function captureProjectCacheSnapshot(
  queryClient: QueryClient,
  projectPath: string,
): ProjectCacheSnapshot {
  return {
    workspace: queryClient.getQueryData<WorkspaceSnapshotDto>(
      workspaceKeys.snapshot(projectPath),
    ),
    searches: queryClient.getQueriesData<WorkspaceSnapshotDto>({
      queryKey: workspaceKeys.searchRoot(projectPath),
    }),
  };
}

export function restoreProjectCacheSnapshot(
  queryClient: QueryClient,
  projectPath: string,
  snapshot: ProjectCacheSnapshot,
): void {
  queryClient.setQueryData(
    workspaceKeys.snapshot(projectPath),
    snapshot.workspace,
  );
  for (const [queryKey, searchSnapshot] of snapshot.searches) {
    queryClient.setQueryData(queryKey, searchSnapshot);
  }
}

function replaceQuestInProjectCaches(
  queryClient: QueryClient,
  projectPath: string,
  quest: QuestDto,
): void {
  patchQuestInSnapshot(
    queryClient,
    workspaceKeys.snapshot(projectPath),
    quest.id,
    quest,
  );
  for (const [queryKey] of queryClient.getQueriesData({
    queryKey: workspaceKeys.searchRoot(projectPath),
  })) {
    patchQuestInSnapshot(queryClient, queryKey, quest.id, quest);
  }
}

function patchQuestInSnapshot(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  id: string,
  patch: Partial<QuestDto>,
): void {
  queryClient.setQueryData<WorkspaceSnapshotDto>(queryKey, (snapshot) =>
    snapshot === undefined
      ? undefined
      : {
          ...snapshot,
          quests: snapshot.quests.map((quest) =>
            quest.id === id ? { ...quest, ...patch } : quest,
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
      queryKey: workspaceKeys.snapshot(projectPath),
    }),
    queryClient.invalidateQueries({
      queryKey: workspaceKeys.searchRoot(projectPath),
    }),
  ]);
}

function questMutationScope(projectPath: string, id: string): string {
  return `quest:${projectPath}:${id}`;
}
