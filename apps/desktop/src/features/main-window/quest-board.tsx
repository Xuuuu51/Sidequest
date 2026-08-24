import { DotsThree } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useSetDraggedQuestStatusMutation } from "../data/queries";
import type { QuestDto, QuestStatus } from "../../shared/tauri/types";
import { IconButton } from "../../shared/ui/icon-button";
import { laneScrollKey, useMainWindowStore } from "../../store/main-window";
import { formatCreatedAt, statusLabel } from "./quest-format";
import { i18n } from "../../shared/i18n/i18n";

const LANES: ReadonlyArray<QuestStatus> = ["inbox", "ready", "done"];

interface QuestBoardProps {
  projectPath: string;
  quests: QuestDto[];
  selectedQuestId: string | null;
  writable: boolean;
  onSelectQuest: (questId: string) => void;
}

export function QuestBoard({
  projectPath,
  quests,
  selectedQuestId,
  writable,
  onSelectQuest,
}: QuestBoardProps) {
  const { t } = useTranslation(["main-window", "common"]);
  const drag = useMainWindowStore((state) => state.drag);
  const setDrag = useMainWindowStore((state) => state.setDrag);

  useEffect(() => {
    function cancelDrag(event: KeyboardEvent): void {
      if (
        event.key === "Escape" &&
        useMainWindowStore.getState().drag !== null
      ) {
        event.preventDefault();
        setDrag(null);
      }
    }
    window.addEventListener("keydown", cancelDrag);
    return () => window.removeEventListener("keydown", cancelDrag);
  }, [setDrag]);

  const draggedQuest = quests.find((quest) => quest.id === drag?.questId);

  return (
    <div className="quest-board" aria-label={t("board.label")}>
      {LANES.map((status) => {
        const laneQuests = quests.filter((quest) => quest.status === status);
        return (
          <QuestLane
            draggedQuest={draggedQuest}
            key={status}
            label={t(`status.${status}`, { ns: "common" })}
            onSelectQuest={onSelectQuest}
            projectPath={projectPath}
            quests={laneQuests}
            selectedQuestId={selectedQuestId}
            status={status}
            writable={writable}
          />
        );
      })}
    </div>
  );
}

interface QuestLaneProps extends Omit<QuestBoardProps, "quests"> {
  draggedQuest: QuestDto | undefined;
  label: string;
  quests: QuestDto[];
  status: QuestStatus;
}

function QuestLane({
  draggedQuest,
  projectPath,
  quests,
  selectedQuestId,
  onSelectQuest,
  label,
  status,
  writable,
}: QuestLaneProps) {
  const { t } = useTranslation("main-window");
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useMainWindowStore((state) => state.drag);
  const setDrag = useMainWindowStore((state) => state.setDrag);
  const savedScroll = useMainWindowStore(
    (state) =>
      state.laneScrollPositions[laneScrollKey(projectPath, status)] ?? 0,
  );
  const setScrollPosition = useMainWindowStore(
    (state) => state.setLaneScrollPosition,
  );
  const showToast = useMainWindowStore((state) => state.showToast);
  const setDraggedQuestStatus = useSetDraggedQuestStatusMutation(projectPath);
  const isTarget =
    drag !== null && drag.fromStatus !== status && drag.overStatus === status;
  const insertionIndex =
    isTarget && draggedQuest !== undefined
      ? sortedInsertionIndex(quests, draggedQuest)
      : -1;

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
          <span
            aria-label={t("board.questCount", { count: quests.length })}
            className="lane-count"
          >
            {quests.length}
          </span>
        </div>
        <IconButton
          disabled
          icon={DotsThree}
          label={t("board.actionsUnavailable", { label })}
          size={16}
        />
      </header>
      <div
        className={isTarget ? "lane-scroll drop-target" : "lane-scroll"}
        onDragEnter={(event) => {
          const currentDrag = useMainWindowStore.getState().drag;
          if (currentDrag !== null && writable) {
            event.preventDefault();
            setDrag({ ...currentDrag, overStatus: status });
          }
        }}
        onDragOver={(event) => {
          if (useMainWindowStore.getState().drag !== null && writable) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = useMainWindowStore.getState().drag;
          setDrag(null);
          if (dropped === null || !writable || dropped.fromStatus === status) {
            return;
          }
          void setDraggedQuestStatus(dropped.questId, status).catch(
            (error: unknown) => {
              if (import.meta.env.DEV) console.error("quest status", error);
              showToast(t("board.statusChangeFailed"));
            },
          );
        }}
        onScroll={(event) =>
          setScrollPosition(projectPath, status, event.currentTarget.scrollTop)
        }
        ref={scroller}
      >
        {quests.map((quest, index) => (
          <div className="quest-card-slot" key={quest.id}>
            {insertionIndex === index && drag?.questId !== quest.id && (
              <span className="drop-indicator" />
            )}
            <QuestCard
              draggable={writable}
              onSelect={() => onSelectQuest(quest.id)}
              projectPath={projectPath}
              quest={quest}
              selected={selectedQuestId === quest.id}
            />
          </div>
        ))}
        {insertionIndex === quests.length && (
          <span className="drop-indicator" />
        )}
        {quests.length === 0 && (
          <div
            className={status === "inbox" ? "lane-empty primary" : "lane-empty"}
          >
            {status === "inbox" ? (
              <>
                <strong>{t("board.noQuestsYet")}</strong>
                <span>{t("board.captureHint")}</span>
              </>
            ) : (
              <span>{t("board.noQuests")}</span>
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
  draggable = false,
  projectPath = "",
  onSelect,
}: {
  quest: QuestDto;
  selected: boolean;
  showStatus?: boolean;
  draggable?: boolean;
  projectPath?: string;
  onSelect: () => void;
}) {
  useTranslation(["main-window", "common"]);
  const editor = useMainWindowStore((state) => state.editor);
  const drag = useMainWindowStore((state) => state.drag);
  const setDrag = useMainWindowStore((state) => state.setDrag);
  const editorBlocksDrag =
    editor?.questId === quest.id &&
    editor.projectPath === projectPath &&
    ["pending", "saving", "saveError", "externalConflict"].includes(
      editor.phase,
    );
  const canDrag = draggable && !editorBlocksDrag;
  const isDragging = drag?.questId === quest.id;

  return (
    <button
      aria-pressed={selected}
      className={`${selected ? "quest-card selected" : "quest-card"}${
        isDragging ? " dragging" : ""
      }`}
      draggable={canDrag}
      onClick={onSelect}
      onDragEnd={() => {
        const currentDrag = useMainWindowStore.getState().drag;
        if (currentDrag?.questId === quest.id) {
          setDrag(null);
        }
      }}
      onDragStart={(event) => {
        if (!canDrag) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", quest.id);
        setDrag({
          questId: quest.id,
          fromStatus: quest.status,
          overStatus: quest.status,
        });
      }}
      title={
        editorBlocksDrag
          ? i18n.t("board.dragBlocked", { ns: "main-window" })
          : undefined
      }
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

function sortedInsertionIndex(quests: QuestDto[], dragged: QuestDto): number {
  const withoutDragged = quests.filter((quest) => quest.id !== dragged.id);
  const index = withoutDragged.findIndex(
    (quest) => compareQuest(dragged, quest) < 0,
  );
  return index === -1 ? withoutDragged.length : index;
}

function compareQuest(left: QuestDto, right: QuestDto): number {
  const created = right.createdAt.localeCompare(left.createdAt);
  return created === 0 ? right.id.localeCompare(left.id) : created;
}
