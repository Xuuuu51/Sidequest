import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useWorkspaceQuery } from "../workspace/data";
import type { ProjectDto } from "../../shared/tauri/types";
import { AlertDialog } from "../../shared/ui/alert-dialog";
import { Button } from "../../shared/ui/button";

interface ProjectRemoveDialogProps {
  project: ProjectDto;
  onCancel: () => void;
  onConfirm: (deleteSidequestData: boolean) => void;
}

export function ProjectRemoveDialog({
  project,
  onCancel,
  onConfirm,
}: ProjectRemoveDialogProps) {
  const { t } = useTranslation(["main-window", "common"]);
  const [deleteSidequestData, setDeleteSidequestData] = useState(false);
  const workspace = useWorkspaceQuery(
    project.state === "unavailable" ? null : project.path,
  );
  const canDeleteSidequestData = workspace.data !== undefined;

  return (
    <AlertDialog.Root
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      open
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-[60] bg-background/70" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-[70] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-elevated p-5 text-elevated-foreground shadow-overlay outline-none">
          <AlertDialog.Title className="text-base font-semibold">
            {t("removeProjectDialog.title", { name: project.name })}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13px] leading-5 text-muted-foreground">
            {t("removeProjectDialog.description")}
          </AlertDialog.Description>

          <div className="mt-3 grid gap-1 rounded-md bg-muted px-3 py-2 text-muted-foreground">
            <p className="truncate font-mono text-[11px]">{project.path}</p>
            <p className="text-xs">
              {workspace.data !== undefined
                ? t("removeProjectDialog.questSummary", {
                    quests: workspace.data.quests.length,
                    issues: workspace.data.issues.length,
                  })
                : workspace.isPending
                  ? t("removeProjectDialog.inspecting")
                  : t("removeProjectDialog.cannotInspect")}
            </p>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-md border p-3 outline-none transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
            <input
              checked={deleteSidequestData}
              className="mt-0.5 size-4 shrink-0 accent-destructive outline-none"
              disabled={!canDeleteSidequestData}
              onChange={(event) => setDeleteSidequestData(event.target.checked)}
              type="checkbox"
            />
            <span className="grid gap-0.5">
              <span className="text-[13px] font-medium text-foreground">
                {t("removeProjectDialog.deleteQuests")}
              </span>
              <span className="text-xs leading-4 text-muted-foreground">
                {canDeleteSidequestData
                  ? t("removeProjectDialog.deleteQuestsDescription")
                  : t("removeProjectDialog.deleteQuestsUnavailable")}
              </span>
            </span>
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-surface px-3 text-[13px] font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
              {t("actions.cancel", { ns: "common" })}
            </AlertDialog.Close>
            <Button
              onClick={() => onConfirm(deleteSidequestData)}
              variant="destructive"
            >
              {t("removeProjectDialog.confirm")}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
