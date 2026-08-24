import type { QuestDto, QuestStatus } from "../../shared/tauri/types";

const STATUS_ORDER: readonly QuestStatus[] = ["inbox", "ready", "done"];

export function visibleQuestOrder(quests: QuestDto[]): QuestDto[] {
  return STATUS_ORDER.flatMap((status) =>
    quests.filter((quest) => quest.status === status).sort(compareQuest),
  );
}

export function sortedInsertionIndex(
  quests: QuestDto[],
  dragged: QuestDto,
): number {
  const withoutDragged = quests.filter((quest) => quest.id !== dragged.id);
  const index = withoutDragged.findIndex(
    (quest) => compareQuest(dragged, quest) < 0,
  );
  return index === -1 ? withoutDragged.length : index;
}

export function compareQuest(left: QuestDto, right: QuestDto): number {
  const created = right.createdAt.localeCompare(left.createdAt);
  return created === 0 ? right.id.localeCompare(left.id) : created;
}
