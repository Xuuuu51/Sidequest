import type { QuestDto } from "../../shared/tauri/types";
import { QuestCard } from "./quest-board";

interface SearchResultsProps {
  query: string;
  quests: QuestDto[];
  selectedQuestId: string | null;
  onClear: () => void;
  onSelectQuest: (questId: string) => void;
}

export function SearchResults({
  query,
  quests,
  selectedQuestId,
  onClear,
  onSelectQuest,
}: SearchResultsProps) {
  return (
    <section className="search-results" aria-label="Search results">
      <header className="search-results-header">
        <h2>Search results</h2>
        <span>{quests.length}</span>
      </header>
      {quests.length === 0 ? (
        <div className="search-empty">
          <strong>No results for “{query}”</strong>
          <span>Try a different word or clear the search.</span>
          <button className="text-button" onClick={onClear} type="button">
            Clear Search
          </button>
        </div>
      ) : (
        <div className="search-list">
          {quests.map((quest) => (
            <QuestCard
              key={quest.id}
              onSelect={() => onSelectQuest(quest.id)}
              quest={quest}
              selected={selectedQuestId === quest.id}
              showStatus
            />
          ))}
        </div>
      )}
    </section>
  );
}
