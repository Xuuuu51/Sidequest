import type { QuestDto } from "../../shared/tauri/types";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("main-window");
  return (
    <section className="search-results" aria-label={t("search.results")}>
      <header className="search-results-header">
        <h2>{t("search.results")}</h2>
        <span>{quests.length}</span>
      </header>
      {quests.length === 0 ? (
        <div className="search-empty">
          <strong>{t("search.noResults", { query })}</strong>
          <span>{t("search.tryAnother")}</span>
          <button className="text-button" onClick={onClear} type="button">
            {t("toolbar.clearSearch")}
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
