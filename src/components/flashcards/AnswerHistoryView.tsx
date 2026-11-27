import { useMemo, useState } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  History,
  Play,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AnswerHistoryEntry,
  ExamScope,
  Flashcard,
  SrsRating,
  StudyMode,
  TypingVerdict,
} from '../../types/flashcards';
import {
  computeHistorySummary,
  filterAnswerHistory,
  formatHistoryTime,
  groupHistoryByDate,
  type HistoryRatingFilter,
} from '../../utils/answerHistory';

interface AnswerHistoryViewProps {
  scopes: ExamScope[];
  cards: Flashcard[];
  answerHistory: AnswerHistoryEntry[];
  activeScopeId: string;
  onReviewCardIds: (cardIds: string[], label: string) => void;
  onClearHistory: () => void;
  onGoToHub: () => void;
}

const PAGE_SIZE = 40;

const RATING_META: Record<
  SrsRating,
  { label: string; badgeClass: string }
> = {
  1: {
    label: 'もう一度',
    badgeClass: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
  },
  2: {
    label: '難しい',
    badgeClass: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]',
  },
  3: {
    label: '普通',
    badgeClass: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]',
  },
  4: {
    label: '簡単',
    badgeClass: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
  },
};

const MODE_LABELS: Record<StudyMode, string> = {
  flip: 'カード',
  typing: '記述',
  redsheet: '赤シート',
};

const VERDICT_META: Record<TypingVerdict, { label: string; className: string }> = {
  exact: { label: '正解', className: 'text-[#15803D]' },
  partial: { label: '部分一致', className: 'text-[#B45309]' },
  mismatch: { label: '不一致', className: 'text-[#991B1B]' },
};

const RATING_FILTER_OPTIONS: Array<{ id: HistoryRatingFilter; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'again', label: 'もう一度' },
  { id: 'hard', label: '難しい' },
  { id: 'good', label: '普通' },
  { id: 'easy', label: '簡単' },
];

export function AnswerHistoryView({
  scopes,
  cards,
  answerHistory,
  activeScopeId,
  onReviewCardIds,
  onClearHistory,
  onGoToHub,
}: AnswerHistoryViewProps) {
  const [ratingFilter, setRatingFilter] = useState<HistoryRatingFilter>('all');
  const [modeFilter, setModeFilter] = useState<'all' | StudyMode>('all');
  const [search, setSearch] = useState('');
  const [hideAnswers, setHideAnswers] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmClear, setConfirmClear] = useState(false);

  const existingCardIds = useMemo(
    () => new Set(cards.map((c) => c.id)),
    [cards]
  );

  const scopeEntries = useMemo(
    () => filterAnswerHistory(answerHistory, { scopeId: activeScopeId }),
    [answerHistory, activeScopeId]
  );

  const filteredEntries = useMemo(
    () =>
      filterAnswerHistory(scopeEntries, {
        scopeId: 'all',
        ratingFilter,
        modeFilter,
        search,
      }),
    [scopeEntries, ratingFilter, modeFilter, search]
  );

  const summary = useMemo(
    () => computeHistorySummary(filteredEntries),
    [filteredEntries]
  );

  const reviewableWeakCardIds = useMemo(
    () => summary.weakCardIds.filter((id) => existingCardIds.has(id)),
    [summary.weakCardIds, existingCardIds]
  );

  const visibleEntries = useMemo(
    () => filteredEntries.slice(0, visibleCount),
    [filteredEntries, visibleCount]
  );

  const dateGroups = useMemo(
    () => groupHistoryByDate(visibleEntries),
    [visibleEntries]
  );

  const hasActiveFilters =
    ratingFilter !== 'all' || modeFilter !== 'all' || search.trim().length > 0;

  const activeScopeName =
    activeScopeId === 'all'
      ? 'すべての考査範囲'
      : scopes.find((s) => s.id === activeScopeId)?.name ?? '選択中';

  const handleResetFilters = () => {
    setRatingFilter('all');
    setModeFilter('all');
    setSearch('');
    setVisibleCount(PAGE_SIZE);
  };

  if (scopeEntries.length === 0) {
    return (
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-8 sm:p-10 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F4F0E8] text-[#78716C] mx-auto">
          <History className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-serif font-bold text-[#1C1917]">
            まだ回答履歴がありません
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] max-w-md mx-auto leading-relaxed">
            一問一答でカード・記述・赤シートの回答を評価すると、日時や自己評価、記述の入力内容が自動でここに記録されます。
          </p>
        </div>
        <div className="pt-1">
          <button
            type="button"
            onClick={onGoToHub}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 text-sm font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl sm:rounded-lg transition-colors"
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            学習をはじめる
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary & Action Strip */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-serif font-bold text-[#1C1917]">
              回答履歴
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              {activeScopeName}
              {hasActiveFilters
                ? `（絞り込み中：${filteredEntries.length}件 / 全${scopeEntries.length}件）`
                : `（全 ${scopeEntries.length} 件の回答記録）`}
            </p>
          </div>

          {reviewableWeakCardIds.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onReviewCardIds(
                  reviewableWeakCardIds,
                  `履歴から復習（もう一度：${reviewableWeakCardIds.length}問）`
                )
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 text-xs font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              間違えた問題を復習（{reviewableWeakCardIds.length}問）
            </button>
          )}
        </div>

        {/* 3 Key Metrics */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#F4F0E8]">
          <div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">回答回数</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#1C1917] mt-0.5">
              {summary.total}
              <span className="text-xs font-sans font-normal text-[#78716C] ml-0.5">
                回
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">正答率</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#15803D] mt-0.5">
              {summary.accuracyPercent !== null ? `${summary.accuracyPercent}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">もう一度</div>
            <div
              className={`text-xl sm:text-2xl font-mono font-semibold tabular-nums mt-0.5 ${
                summary.againCount > 0 ? 'text-[#991B1B]' : 'text-[#1C1917]'
              }`}
            >
              {summary.againCount}
              <span className="text-xs font-sans font-normal text-[#78716C] ml-0.5">
                回
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Compact Filter Bar */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-4 space-y-3">
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <div
            role="group"
            aria-label="評価で絞り込み"
            className="inline-flex items-center gap-1 p-1 bg-[#F4F0E8] rounded-lg min-w-full sm:min-w-0"
          >
            {RATING_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={ratingFilter === opt.id}
                onClick={() => {
                  setRatingFilter(opt.id);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={`flex-1 sm:flex-initial min-h-[34px] sm:min-h-[30px] px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ratingFilter === opt.id
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              placeholder="問題・解答・単元・入力内容で検索…"
              aria-label="回答履歴を検索"
              className="w-full h-10 pl-9 pr-8 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#9A3412]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="検索語をクリア"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value as 'all' | StudyMode);
                setVisibleCount(PAGE_SIZE);
              }}
              aria-label="学習モードで絞り込み"
              className="flex-1 sm:flex-initial h-10 px-3 text-xs font-medium bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            >
              <option value="all">すべてのモード</option>
              <option value="flip">カード</option>
              <option value="typing">記述</option>
              <option value="redsheet">赤シート</option>
            </select>

            <button
              type="button"
              aria-pressed={hideAnswers}
              onClick={() => {
                setHideAnswers((prev) => !prev);
                setRevealedIds({});
              }}
              className={`inline-flex items-center justify-center gap-1.5 h-10 px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                hideAnswers
                  ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                  : 'bg-white text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917] hover:border-[#1C1917]'
              }`}
            >
              {hideAnswers ? (
                <>
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  解答を表示
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  解答を隠す
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Date-Grouped Timeline List */}
      {filteredEntries.length === 0 ? (
        <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-[#57534E]">
            条件に一致する回答履歴はありません。
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="min-h-[40px] px-4 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg transition-colors"
          >
            絞り込みをリセット
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {dateGroups.map((group) => (
            <section key={group.dateKey} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-[#57534E] tracking-wide">
                  {group.label}
                </h3>
                <span className="text-[11px] font-mono tabular-nums text-[#78716C]">
                  {group.entries.length}件
                </span>
              </div>

              <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl divide-y divide-[#F4F0E8] overflow-hidden">
                {group.entries.map((entry) => {
                  const ratingMeta = RATING_META[entry.rating];
                  const canReview = existingCardIds.has(entry.cardId);
                  const isAnswerHidden = hideAnswers && !revealedIds[entry.id];
                  const verdictMeta = entry.typingVerdict
                    ? VERDICT_META[entry.typingVerdict]
                    : null;

                  return (
                    <article
                      key={entry.id}
                      className="p-4 sm:px-5 sm:py-4 space-y-2"
                    >
                      {/* Row Top Meta */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold border rounded-md whitespace-nowrap ${ratingMeta.badgeClass}`}
                          >
                            {ratingMeta.label}
                          </span>
                          <span className="text-[11px] text-[#78716C] whitespace-nowrap">
                            {MODE_LABELS[entry.mode]}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-[#D6CEBE] text-xs"
                          >
                            ·
                          </span>
                          <span className="text-xs text-[#57534E] font-mono tabular-nums whitespace-nowrap">
                            No.{entry.cardNumber}
                          </span>
                          <span className="text-xs text-[#78716C] truncate max-w-[160px] sm:max-w-[260px]">
                            {entry.unit}
                          </span>
                          {!entry.recordedToSrs && (
                            <span className="text-[10px] text-[#78716C] bg-[#F4F0E8] px-1.5 py-0.5 rounded whitespace-nowrap">
                              記録OFF
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <time
                            dateTime={new Date(entry.answeredAt).toISOString()}
                            className="text-[11px] font-mono tabular-nums text-[#78716C]"
                          >
                            {formatHistoryTime(entry.answeredAt)}
                          </time>
                          {canReview && (
                            <button
                              type="button"
                              onClick={() =>
                                onReviewCardIds(
                                  [entry.cardId],
                                  `復習：No.${entry.cardNumber}`
                                )
                              }
                              className="inline-flex items-center gap-1 min-h-[32px] px-2.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md transition-colors whitespace-nowrap"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              復習
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Question */}
                      <p className="text-sm sm:text-[15px] text-[#1C1917] leading-relaxed">
                        {entry.front}
                      </p>

                      {/* Answer */}
                      <div className="flex flex-wrap items-baseline justify-between gap-2 pt-0.5">
                        {isAnswerHidden ? (
                          <button
                            type="button"
                            onClick={() =>
                              setRevealedIds((prev) => ({
                                ...prev,
                                [entry.id]: true,
                              }))
                            }
                            className="px-3 py-1.5 text-xs font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-md transition-colors"
                          >
                            タップして解答を表示
                          </button>
                        ) : (
                          <div className="text-sm sm:text-[15px] font-serif font-semibold text-[#9A3412] leading-snug">
                            {entry.back}
                          </div>
                        )}
                      </div>

                      {/* Typing Mode Input Record */}
                      {entry.mode === 'typing' && entry.typedAnswer && (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs bg-[#FBF9F5] border border-[#EFECE6] rounded-lg px-3 py-1.5">
                          <span className="text-[#78716C]">あなたの入力:</span>
                          <span className="font-medium text-[#1C1917]">
                            {entry.typedAnswer}
                          </span>
                          {verdictMeta && (
                            <span className={`font-semibold ${verdictMeta.className}`}>
                              （{verdictMeta.label}）
                            </span>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Load More */}
          {visibleCount < filteredEntries.length && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="min-h-[42px] px-5 text-xs font-medium text-[#1C1917] bg-white border border-[#E6E0D6] hover:border-[#1C1917] rounded-xl sm:rounded-lg transition-colors"
              >
                さらに表示（残り {filteredEntries.length - visibleCount} 件）
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clear History Footer (Inline 2-step confirmation, no window.confirm) */}
      {answerHistory.length > 0 && (
        <div className="pt-2">
          {!confirmClear ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 text-xs text-[#78716C] hover:text-[#991B1B] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                回答履歴をクリア
              </button>
            </div>
          ) : (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[#991B1B] leading-relaxed">
                これまでの回答履歴（全 {answerHistory.length} 件）をすべて削除しますか？忘却曲線の定着データは保持されます。
              </p>
              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[36px] px-3 text-xs font-medium text-[#57534E] bg-white border border-[#E6E0D6] rounded-lg hover:text-[#1C1917]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmClear(false);
                    onClearHistory();
                  }}
                  className="min-h-[36px] px-3.5 text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg"
                >
                  削除する
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
