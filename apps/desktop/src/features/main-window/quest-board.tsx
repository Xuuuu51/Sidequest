import { DotsThree } from "@phosphor-icons/react";
import { useLayoutEffect, useRef } from "react";

import type { QuestDto, QuestStatus } from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { laneScrollKey, useMainWindowStore } from "../../store/main-window";
import { formatCreatedAt, statusLabel } from "./quest-format";

const LANES: ReadonlyArray<{ status: QuestStatus; label: string }> = [
  { status: "inbox", label: "Inbox" },
  { status: "ready", label: "Ready" },
  { status: "done", label: "Done" },
];

interface QuestBoardProps {
  projectPath: string;
  quests: QuestDto[];
  selectedQuestId: string | null;
  onSelectQuest: (questId: string) => void;
}

export function QuestBoard({
  projectPath,
  quests,
  selectedQuestId,
  onSelectQuest,
}: QuestBoardProps) {
  return (
    <div className="quest-board" aria-label="Quest board">
      {LANES.map((lane) => {
        const laneQuests = quests.filter(
          (quest) => quest.status === lane.status,
        );
        return (
          <QuestLane
            key={lane.status}
            label={lane.label}
            onSelectQuest={onSelectQuest}
            projectPath={projectPath}
            quests={laneQuests}
            selectedQuestId={selectedQuestId}
            status={lane.status}
          />
        );
      })}
    </div>
  );
}

interface QuestLaneProps extends QuestBoardProps {
  label: string;
  status: QuestStatus;
}

function QuestLane({
  projectPath,
  quests,
  selectedQuestId,
  onSelectQuest,
  label,
  status,
}: QuestLaneProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const savedScroll = useMainWindowStore(
    (state) =>
      state.laneScrollPositions[laneScrollKey(projectPath, status)] ?? 0,
  );
  const setScrollPosition = useMainWindowStore(
    (state) => state.setLaneScrollPosition,
  );

  useLayoutEffect(() => {
    if (scroller.current !== null) {
      scroller.current.scrollTop = savedScroll;
    }
  }, [savedScroll]);

  return (
    <section className={`quest-lane status-${status}`}>
      <header className="lane-header">
        <div className="lane-title">
          <span aria-hidden="true" className="status-dot" />
          <h2>{label}</h2>
          <span aria-label={`${quests.length} quests`} className="lane-count">
            {quests.length}
          </span>
        </div>
        <IconButton
          disabled
          icon={DotsThree}
          label={`${label} actions are not available yet`}
          size={16}
        />
      </header>
      <div
        className="lane-scroll"
        onScroll={(event) =>
          setScrollPosition(projectPath, status, event.currentTarget.scrollTop)
        }
        ref={scroller}
      >
        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            onSelect={() => onSelectQuest(quest.id)}
            quest={quest}
            selected={selectedQuestId === quest.id}
          />
        ))}
        {quests.length === 0 && (
          <div
            className={status === "inbox" ? "lane-empty primary" : "lane-empty"}
          >
            {status === "inbox" ? (
              <>
                <strong>No quests yet</strong>
                <span>Use ⌘⇧Space to capture one.</span>
              </>
            ) : (
              <span>No quests</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function QuestCard({
  quest,
  selected,
  showStatus = false,
  onSelect,
}: {
  quest: QuestDto;
  selected: boolean;
  showStatus?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={selected ? "quest-card selected" : "quest-card"}
      onClick={onSelect}
      type="button"
    >
      <span className="quest-content-preview">{quest.content}</span>
      <span className="quest-card-meta">
        <span>{formatCreatedAt(quest.createdAt)}</span>
        {showStatus && (
          <span className={`search-status status-${quest.status}`}>
            <span aria-hidden="true" className="status-dot" />
            {statusLabel(quest.status)}
          </span>
        )}
      </span>
    </button>
  );
}
