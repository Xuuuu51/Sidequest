import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getIntegrationStatus,
  installAgentSkill,
  installCli,
  uninstallAgentSkill,
  uninstallCli,
} from "../../shared/tauri/commands";
import type {
  IntegrationId,
  IntegrationItemDto,
} from "../../shared/tauri/types";

export const integrationsKey = ["integrations"] as const;

export function useIntegrationsQuery() {
  return useQuery({
    queryKey: integrationsKey,
    queryFn: getIntegrationStatus,
  });
}

export function useIntegrationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: IntegrationId;
      action: "install" | "uninstall";
    }) => {
      if (id === "cli") {
        return action === "install" ? installCli() : uninstallCli();
      }
      return action === "install"
        ? installAgentSkill(id)
        : uninstallAgentSkill(id);
    },
    onSuccess: (items: IntegrationItemDto[]) =>
      queryClient.setQueryData(integrationsKey, items),
  });
}
