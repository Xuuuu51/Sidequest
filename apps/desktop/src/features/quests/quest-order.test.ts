import { describe, expect, it } from "vitest";

import type { QuestDto } from "../../shared/tauri/types";
import { sortedInsertionIndex, visibleQuestOrder } from "./quest-order";

const quests: QuestDto[] = [
  quest("ready-old", "ready", "2026-08-20T10:00:00Z"),
  quest("done-new", "done", "2026-08-24T10:00:00Z"),
  quest("inbox-new", "inbox", "2026-08-23T10:00:00Z"),
  quest("ready-new", "ready", "2026-08-22T10:00:00Z"),
];

describe("Quest list ordering", () => {
  it("orders visible quests by fixed groups and descending creation time", () => {
    expect(visibleQuestOrder(quests).map(({ id }) => id)).toEqual([
      "inbox-new",
      "ready-new",
      "ready-old",
      "done-new",
    ]);
  });

  it("computes a fixed insertion position independent of pointer location", () => {
    const targetGroup = visibleQuestOrder(quests).filter(
      ({ status }) => status === "ready",
    );
    expect(
      sortedInsertionIndex(
        targetGroup,
        quest("dragged", "inbox", "2026-08-21T10:00:00Z"),
      ),
    ).toBe(1);
  });
});

function quest(
  id: string,
  status: QuestDto["status"],
  createdAt: string,
): QuestDto {
  return { id, status, createdAt, content: id };
}
