import { X } from "@phosphor-icons/react";

import type { QuestDto } from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { ResizeHandle } from "../../shared/ui/resize-handle";
import { useMainWindowStore } from "../../store/main-window";

interface QuestDrawerProps {
  quest: QuestDto;
  onClose: () => void;
  onPersistPreferences: () => void;
}

export function QuestDrawer({
  quest,
  onClose,
  onPersistPreferences,
}: QuestDrawerProps) {
  const drawerWidth = useMainWindowStore((state) => state.drawerWidth);
  const setDrawerWidth = useMainWindowStore((state) => state.setDrawerWidth);

  return (
    <aside
      aria-label="Quest details"
      className="quest-drawer"
      style={{ width: drawerWidth }}
    >
      <ResizeHandle
        ariaLabel="Resize Quest details"
        direction={-1}
        maximum={560}
        minimum={420}
        onChange={setDrawerWidth}
        onCommit={onPersistPreferences}
        value={drawerWidth}
      />
      <header className="drawer-header">
        <h2>Quest details</h2>
        <IconButton icon={X} label="Close Quest details" onClick={onClose} />
      </header>
      <div className="drawer-body">
        <div className="drawer-content" tabIndex={0}>
          {quest.content}
        </div>
        <time className="drawer-created" dateTime={quest.createdAt}>
          {formatAbsoluteCreatedAt(quest.createdAt)}
        </time>
      </div>
    </aside>
  );
}

function formatAbsoluteCreatedAt(createdAt: string): string {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return "Created at an unknown time";
  }
  return `Created ${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(created)}`;
}
