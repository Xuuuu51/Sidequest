import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useSetDraggedQuestStatusMutation } from "@/features/quests/data";
import { cn } from "@/shared/lib/utils";
import type { QuestDto, QuestStatus } from "@/shared/tauri/types";
import { useMainWindowStore } from "@/store/main-window/store";
import { laneScrollKey } from "@/store/main-window/types";

import { formatCreatedAt, splitQuestContent } from "./quest-format";
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
  writable: boolean;
  drawerOpen: boolean;
  searchActive: boolean;
  searching: boolean;
  onSelectQuest: (questId: string) => void;
  onRegisterRow: (questId: string, element: HTMLButtonElement | null) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function QuestBoard({
  projectPath,
  quests,
  writable,
  drawerOpen,
  searchActive,
  searching,
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
        className="relative flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden bg-workspace p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
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
            onRegisterRow={onRegisterRow}
            onSelectQuest={onSelectQuest}
            projectPath={projectPath}
            pendingQuestIds={pendingQuestIds}
            quests={grouped[status]}
            searchActive={searchActive}
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
  writable,
  drawerOpen,
  onSelectQuest,
  onRegisterRow,
  searchActive,
}: {
  activeQuest: QuestDto | undefined;
  status: QuestStatus;
  quests: QuestDto[];
  projectPath: string;
  pendingQuestIds: Set<string>;
  writable: boolean;
  drawerOpen: boolean;
  onSelectQuest: (questId: string) => void;
  onRegisterRow: (questId: string, element: HTMLButtonElement | null) => void;
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
        "relative flex h-full min-h-0 w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-lane transition-[background-color,box-shadow] duration-[var(--motion-normal)]",
        isDropTarget && "bg-brand-subtle ring-1 ring-inset ring-brand/35",
      )}
      data-status={status}
      ref={ref}
    >
      <header className="z-20 flex h-12 shrink-0 items-center gap-2 bg-transparent px-4 transition-colors duration-[var(--motion-normal)]">
        <StatusIndicator status={status} />
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
          {t(`status.${status}`, { ns: "common" })}
        </h2>
        <span
          aria-label={t("board.questCount", { count: quests.length })}
          className="text-[12px] tabular-nums text-muted-foreground"
        >
          {quests.length}
        </span>
      </header>

      <div
        className="quest-lane-scroll relative min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-3"
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
              writable={writable && !pendingQuestIds.has(quest.id)}
            />
          </div>
        ))}
        {insertionIndex === quests.length && <DropIndicator />}
        {quests.length === 0 && (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border/70 bg-surface/25 px-3 text-xs text-muted-foreground">
            <span>{t("board.noQuests")}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function QuestRow({
  quest,
  writable,
  projectPath,
  drawerOpen,
  onSelect,
  onRegisterRow,
}: {
  quest: QuestDto;
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
      className={cn(
        "relative flex min-h-[108px] w-full items-stretch overflow-hidden rounded-lg border border-border/80 bg-surface px-4 py-3.5 text-left shadow-card outline-none transition-[background-color,border-color,box-shadow] duration-[var(--motion-normal)] hover:border-input hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-lane",
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
      <QuestRowVisual quest={quest} />
    </button>
  );
}

function DropIndicator() {
  return (
    <span className="pointer-events-none absolute inset-x-1 -top-[6px] z-10 h-0.5 rounded-full bg-brand shadow-[0_0_0_3px_var(--brand-subtle)] before:absolute before:-left-0.5 before:top-1/2 before:size-1.5 before:-translate-y-1/2 before:rounded-full before:bg-brand after:absolute after:-right-0.5 after:top-1/2 after:size-1.5 after:-translate-y-1/2 after:rounded-full after:bg-brand" />
  );
}

function StatusIndicator({ status }: { status: QuestStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-[18px] place-items-center rounded-full border",
        status === "inbox" && "border-status-inbox/70",
        status === "ready" && "border-status-ready/70",
        status === "done" && "border-status-done/70",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "inbox" && "bg-status-inbox",
          status === "ready" && "bg-status-ready",
          status === "done" && "bg-status-done",
        )}
      />
    </span>
  );
}

function QuestRowVisual({
  quest,
  overlay = false,
}: {
  quest: QuestDto;
  overlay?: boolean;
}) {
  const { title, summary } = splitQuestContent(quest.content);

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 flex-col",
        overlay &&
          "min-h-[108px] w-[296px] rotate-[-1.5deg] rounded-lg border border-border/80 bg-elevated px-4 py-3.5 shadow-overlay motion-reduce:rotate-0",
      )}
    >
      <span className="line-clamp-2 min-w-0 whitespace-pre-wrap text-[14px] font-medium leading-5 tracking-[-0.01em] text-foreground [overflow-wrap:anywhere]">
        {title}
      </span>
      {summary !== null && (
        <span className="mt-1 line-clamp-2 min-w-0 whitespace-pre-wrap text-[13px] leading-[18px] text-muted-foreground [overflow-wrap:anywhere]">
          {summary}
        </span>
      )}
      <time className="mt-auto self-end pt-3 text-[11px] tabular-nums text-muted-foreground">
        {formatCreatedAt(quest.createdAt)}
      </time>
    </span>
  );
}
