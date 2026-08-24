import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { GripVertical, Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSetDraggedQuestStatusMutation } from "@/features/quests/data";
import { cn } from "@/shared/lib/utils";
import type { QuestDto, QuestStatus } from "@/shared/tauri/types";
import { Button } from "@/shared/ui/button";
import { useMainWindowStore } from "@/store/main-window/store";
import { laneScrollKey } from "@/store/main-window/types";

import { formatCreatedAt } from "./quest-format";
import { compareQuest, sortedInsertionIndex } from "./quest-order";

const STATUSES: readonly QuestStatus[] = ["inbox", "ready", "done"];
const QUEST_DRAG_TYPE = "quest";
const sensors = [
  PointerSensor.configure({
    activationConstraints: [
      new PointerActivationConstraints.Distance({ value: 6 }),
    ],
    preventActivation(event) {
      return (
        (event.target as Element | null)?.closest("[data-no-drag]") !== null
      );
    },
  }),
];

interface QuestBoardProps {
  projectPath: string;
  quests: QuestDto[];
  selectedQuestId: string | null;
  writable: boolean;
  drawerOpen: boolean;
  searchActive: boolean;
  searching: boolean;
  onNewQuest: () => void;
  onSelectQuest: (questId: string) => void;
  onRegisterRow: (questId: string, element: HTMLButtonElement | null) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function QuestBoard({
  projectPath,
  quests,
  selectedQuestId,
  writable,
  drawerOpen,
  searchActive,
  searching,
  onNewQuest,
  onSelectQuest,
  onRegisterRow,
  listRef,
}: QuestBoardProps) {
  const { t } = useTranslation(["main-window", "common"]);
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [pendingQuestIds, setPendingQuestIds] = useState<Set<string>>(
    () => new Set(),
  );
  const setDraggedQuestStatus = useSetDraggedQuestStatusMutation(projectPath);
  const activeQuest = quests.find((quest) => quest.id === activeQuestId);
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((status) => [
          status,
          quests.filter((quest) => quest.status === status).sort(compareQuest),
        ]),
      ) as Record<QuestStatus, QuestDto[]>,
    [quests],
  );

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={(event) =>
        setActiveQuestId(String(event.operation.source?.id ?? "") || null)
      }
      onDragEnd={(event) => {
        const source = event.operation.source;
        const target = event.operation.target;
        setActiveQuestId(null);
        if (event.canceled || source === null || target === null) return;
        const quest = source.data.quest as QuestDto | undefined;
        const nextStatus = target.data.status as QuestStatus | undefined;
        if (quest === undefined || nextStatus === undefined) return;
        if (quest.status === nextStatus) return;
        setPendingQuestIds((current) => new Set(current).add(quest.id));
        void setDraggedQuestStatus(quest.id, nextStatus)
          .catch(() => toast.error(t("board.statusChangeFailed")))
          .finally(() =>
            setPendingQuestIds((current) => {
              const next = new Set(current);
              next.delete(quest.id);
              return next;
            }),
          );
      }}
    >
      <div
        aria-busy={searching}
        aria-label={t("board.label")}
        className="relative grid min-h-0 flex-1 grid-cols-3 divide-x overflow-hidden bg-workspace outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        data-layout="kanban"
        ref={listRef}
        tabIndex={-1}
      >
        {searching && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-30 text-right text-xs text-muted-foreground"
            role="status"
          >
            <span className="inline-block rounded-b-md bg-workspace/90 px-2 py-1 backdrop-blur">
              {t("workspace.searching")}
            </span>
          </div>
        )}
        {STATUSES.map((status) => (
          <QuestGroup
            activeQuest={activeQuest}
            drawerOpen={drawerOpen}
            key={status}
            onNewQuest={onNewQuest}
            onRegisterRow={onRegisterRow}
            onSelectQuest={onSelectQuest}
            projectPath={projectPath}
            pendingQuestIds={pendingQuestIds}
            quests={grouped[status]}
            searchActive={searchActive}
            showNewQuest={!searchActive && quests.length === 0}
            selectedQuestId={selectedQuestId}
            status={status}
            writable={writable}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeQuest === undefined ? null : (
          <QuestRowVisual quest={activeQuest} overlay />
        )}
      </DragOverlay>
    </DragDropProvider>
  );
}

function QuestGroup({
  activeQuest,
  status,
  quests,
  projectPath,
  pendingQuestIds,
  selectedQuestId,
  writable,
  drawerOpen,
  onSelectQuest,
  onNewQuest,
  onRegisterRow,
  showNewQuest,
  searchActive,
}: {
  activeQuest: QuestDto | undefined;
  status: QuestStatus;
  quests: QuestDto[];
  projectPath: string;
  pendingQuestIds: Set<string>;
  selectedQuestId: string | null;
  writable: boolean;
  drawerOpen: boolean;
  onSelectQuest: (questId: string) => void;
  onNewQuest: () => void;
  onRegisterRow: (questId: string, element: HTMLButtonElement | null) => void;
  showNewQuest: boolean;
  searchActive: boolean;
}) {
  const { t } = useTranslation(["main-window", "common"]);
  const { ref, isDropTarget } = useDroppable({
    id: `status:${status}`,
    type: QUEST_DRAG_TYPE,
    accept: QUEST_DRAG_TYPE,
    data: { status },
  });
  const insertionIndex =
    isDropTarget && activeQuest !== undefined
      ? sortedInsertionIndex(quests, activeQuest)
      : -1;
  const scroller = useRef<HTMLDivElement>(null);
  const savedScroll = useMainWindowStore(
    (state) =>
      state.laneScrollPositions[laneScrollKey(projectPath, status)] ?? 0,
  );
  const setLaneScrollPosition = useMainWindowStore(
    (state) => state.setLaneScrollPosition,
  );

  useLayoutEffect(() => {
    if (!searchActive && scroller.current !== null) {
      scroller.current.scrollTop = savedScroll;
    }
  }, [savedScroll, searchActive]);

  return (
    <section
      className={cn(
        "relative flex min-h-0 min-w-0 flex-col",
        isDropTarget && "bg-accent/30 ring-1 ring-inset ring-border",
      )}
      data-status={status}
      ref={ref}
    >
      <header className="z-20 flex h-10 shrink-0 items-center gap-2 border-b bg-workspace px-3">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full",
            status === "inbox" && "bg-status-inbox",
            status === "ready" && "bg-status-ready",
            status === "done" && "bg-status-done",
          )}
        />
        <h2 className="text-xs font-semibold tracking-wide text-foreground">
          {t(`status.${status}`, { ns: "common" })}
        </h2>
        <span
          aria-label={t("board.questCount", { count: quests.length })}
          className="text-xs tabular-nums text-muted-foreground"
        >
          {quests.length}
        </span>
      </header>

      <div
        className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
        onScroll={(event) => {
          if (!searchActive) {
            setLaneScrollPosition(
              projectPath,
              status,
              event.currentTarget.scrollTop,
            );
          }
        }}
        ref={scroller}
      >
        {quests.map((quest, index) => (
          <div className="relative" key={quest.id}>
            {insertionIndex === index && activeQuest?.id !== quest.id && (
              <DropIndicator />
            )}
            <QuestRow
              drawerOpen={drawerOpen}
              onRegisterRow={onRegisterRow}
              onSelect={() => onSelectQuest(quest.id)}
              projectPath={projectPath}
              quest={quest}
              selected={selectedQuestId === quest.id}
              writable={writable && !pendingQuestIds.has(quest.id)}
            />
          </div>
        ))}
        {insertionIndex === quests.length && <DropIndicator />}
        {quests.length === 0 && (
          <div className="flex min-h-24 items-center justify-between rounded-lg border border-dashed bg-surface/30 px-3 text-xs text-muted-foreground">
            <span>
              {status === "inbox"
                ? t("board.noQuestsYet")
                : t("board.noQuests")}
            </span>
            {status === "inbox" && writable && showNewQuest && (
              <Button
                data-no-drag
                onClick={onNewQuest}
                size="sm"
                variant="outline"
              >
                <Plus aria-hidden="true" size={14} />
                {t("toolbar.newQuest")}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function QuestRow({
  quest,
  selected,
  writable,
  projectPath,
  drawerOpen,
  onSelect,
  onRegisterRow,
}: {
  quest: QuestDto;
  selected: boolean;
  writable: boolean;
  projectPath: string;
  drawerOpen: boolean;
  onSelect: () => void;
  onRegisterRow: (questId: string, element: HTMLButtonElement | null) => void;
}) {
  const editor = useMainWindowStore((state) => state.editor);
  const editorBlocksDrag =
    editor?.questId === quest.id &&
    editor.projectPath === projectPath &&
    ["pending", "saving", "saveError", "externalConflict"].includes(
      editor.phase,
    );
  const canDrag = writable && !drawerOpen && !editorBlocksDrag;
  const { ref, isDragging } = useDraggable({
    id: quest.id,
    type: QUEST_DRAG_TYPE,
    data: { quest },
    disabled: !canDrag,
  });

  return (
    <button
      aria-pressed={selected}
      className={cn(
        "group relative flex min-h-[104px] max-h-[132px] w-full items-stretch overflow-hidden rounded-lg border bg-surface px-4 py-3 text-left shadow-card outline-none transition-[background-color,border-color,box-shadow] duration-[var(--motion-normal)] hover:border-input hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-workspace",
        selected &&
          "border-border bg-brand-subtle text-foreground before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-r-full before:bg-brand",
        isDragging && "opacity-35",
      )}
      onClick={onSelect}
      ref={(element) => {
        ref(element);
        onRegisterRow(quest.id, element);
      }}
      title={
        editorBlocksDrag
          ? "Save or resolve this Quest before dragging"
          : undefined
      }
      type="button"
    >
      <GripVertical
        aria-hidden="true"
        className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
        size={14}
      />
      <QuestRowVisual quest={quest} />
    </button>
  );
}

function DropIndicator() {
  return (
    <span className="pointer-events-none absolute inset-x-2 -top-[5px] z-10 h-0.5 rounded-full bg-ring" />
  );
}

function QuestRowVisual({
  quest,
  overlay = false,
}: {
  quest: QuestDto;
  overlay?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 flex-col justify-between gap-1",
        overlay &&
          "min-h-[104px] w-[min(340px,34vw)] rounded-lg border bg-elevated px-4 py-3 shadow-overlay",
      )}
    >
      <span className="line-clamp-4 min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-[18px] text-foreground [overflow-wrap:anywhere]">
        {quest.content}
      </span>
      <time className="self-end shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatCreatedAt(quest.createdAt)}
      </time>
    </span>
  );
}
