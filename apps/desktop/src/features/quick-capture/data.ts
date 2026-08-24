import { useMutation } from "@tanstack/react-query";

import { captureQuest } from "../../shared/tauri/commands";
import type { QuickCaptureResultDto } from "../../shared/tauri/types";

export function useCaptureQuestMutation() {
  return useMutation({
    mutationFn: ({
      projectPath,
      content,
    }: {
      projectPath: string;
      content: string;
    }): Promise<QuickCaptureResultDto> => captureQuest(projectPath, content),
  });
}
