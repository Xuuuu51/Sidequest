import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setAppStateCache } from "../app-state/data";
import { setOnboardingStep } from "../../shared/tauri/commands";
import type { OnboardingStep } from "../../shared/tauri/types";

export function useSetOnboardingStepMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (step: OnboardingStep) => setOnboardingStep(step),
    onSuccess: (appState) => setAppStateCache(queryClient, appState),
  });
}
