import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Eye,
  FolderPlus,
  Layers,
  PenLine,
  Play,
  Plus,
  Shuffle,
  Star,
  Tag,
  Upload,
} from 'lucide-react';
import type {
  ExamScope,
  Flashcard,
  SrsProgressMap,
  StudyFilterPreset,
  StudyMode,
  StudySessionConfig,
  TagMatchMode,
} from '../../types/flashcards';
import {
  buildChapterHierarchy,
  buildTagCategoryGroups,
  filterCardsByBaseCriteria,
} from '../../utils/flashcardFilter';
import {
  calculateRetentionPercent,
  getSrsProgress,
  isCardDue,
  isCardMastered,
  isCardWeak,
} from '../../utils/srsEngine';

interface FlashcardHubViewProps {
  scopes: ExamScope[];
  cards: Flashcard[];
  srsMap: SrsProgressMap;
  activeScopeId: string;
  streakDays: number;
  todayReviews: number;
  onChangeScopeId: (scopeId: string) => void;
  onLaunchSession: (config: StudySessionConfig) => void;
  onOpenAddCard: () => void;
  onOpenBulkImport: () => void;
  onOpenScopeManager: () => void;
}

export function FlashcardHubView({
  scopes,
  cards,
  srsMap,
  activeScopeId,
  streakDays,
  todayReviews,
  onChangeScopeId,
  onLaunchSession,
  onOpenAddCard,
  onOpenBulkImport,
  onOpenScopeManager,
}: FlashcardHubViewProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>('and');
  const [tagSearch, setTagSearch] = useState('');
  const [mobileBrowseTab, setMobileBrowseTab] = useState<'units' | 'tags'>('units');
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [expandedTagCategories, setExpandedTagCategories] = useState<Record<string, boolean>>({
    importance: true,
    category: true,
    region: true,
    lesson: false,
    custom: true,
  });

  const nowMs = Date.now();

  const scopeCards = useMemo(
    () =>
      cards.filter(
        (c) => !c.suspended && (activeScopeId === 'all' || c.scopeId === activeScopeId)
      ),
    [cards, activeScopeId]
  );

  const scopeStats = useMemo(() => {
    let due = 0;
    let newCount = 0;
    let learned = 0;
    let mastered = 0;
    let weak = 0;
    let starred = 0;
    let retSum = 0;
    let retCount = 0;

    for (const card of scopeCards) {
      const prog = getSrsProgress(srsMap, card.id);
      if (prog.state === 'new') {
        newCount += 1;
      } else {
        learned += 1;
        const ret = calculateRetentionPercent(prog, nowMs);
        if (ret !== null) {
          retSum += ret;
          retCount += 1;
        }
      }
      if (isCardDue(prog, nowMs)) due += 1;
      if (isCardMastered(prog)) mastered += 1;
      if (isCardWeak(prog, nowMs)) weak += 1;
      if (card.starred) starred += 1;
    }

    return {
      total: scopeCards.length,
      due,
      newCount,
      learned,
      mastered,
      weak,
      starred,
      avgRetention: retCount > 0 ? Math.round(retSum / retCount) : null,
    };
  }, [scopeCards, srsMap, nowMs]);

  const chapterGroups = useMemo(
    () => buildChapterHierarchy(scopeCards, srsMap, nowMs),
    [scopeCards, srsMap, nowMs]
  );

  const tagGroups = useMemo(
    () => buildTagCategoryGroups(scopeCards, srsMap, nowMs),
    [scopeCards, srsMap, nowMs]
  );

  const filteredTagGroups = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return tagGroups;
    return tagGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            item.meta.displayLabel.toLowerCase().includes(q) ||
            item.meta.raw.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [tagGroups, tagSearch]);

  const matchedBySelectedTags = useMemo(() => {
    if (selectedTags.length === 0) return scopeCards;
    return filterCardsByBaseCriteria(
      scopeCards,
      {
        scopeId: activeScopeId,
        chapter: 'all',
        unit: 'all',
        selectedTags,
        tagMatchMode,
      },
      false
    );
  }, [scopeCards, activeScopeId, selectedTags, tagMatchMode]);

  const matchedDueCount = useMemo(() => {
    return matchedBySelectedTags.filter((c) =>
      isCardDue(getSrsProgress(srsMap, c.id), nowMs)
    ).length;
  }, [matchedBySelectedTags, srsMap, nowMs]);

  const activeScope = scopes.find((s) => s.id === activeScopeId);

  const toggleTag = (rawTag: string) => {
    setSelectedTags((prev) =>
      prev.includes(rawTag) ? prev.filter((t) => t !== rawTag) : [...prev, rawTag]
    );
  };

  const launchQuickPreset = (
    filterPreset: StudyFilterPreset,
    mode: StudyMode,
    extra?: Partial<StudySessionConfig>
  ) => {
    onLaunchSession({
      scopeId: activeScopeId,
      chapter: 'all',
      unit: 'all',
      selectedTags: [],
      tagMatchMode: 'and',
      filterPreset,
      orderMode: filterPreset === 'due' ? 'srs' : 'unit',
      swapFrontBack: false,
      recordToSrs: true,
      mode,
      ...extra,
    });
  };

  const launchTagStudy = (mode: StudyMode, filterPreset: StudyFilterPreset = 'all') => {
    onLaunchSession({
      scopeId: activeScopeId,
      chapter: 'all',
      unit: 'all',
      selectedTags,
      tagMatchMode,
      filterPreset,
      orderMode: filterPreset === 'due' ? 'srs' : 'unit',
      swapFrontBack: false,
      recordToSrs: true,
      mode,
      label:
        selectedTags.length > 0
          ? `タグ演習（${selectedTags.length}件選択・${tagMatchMode.toUpperCase()}）`
          : activeScope?.name ?? '全範囲',
    });
  };

  const cardCountsByScope = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      if (!c.suspended) {
        counts[c.scopeId] = (counts[c.scopeId] ?? 0) + 1;
      }
    }
    return counts;
  }, [cards]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Scope selector bar (Horizontal scroll strip on mobile) */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 sm:pb-5 border-b border-[#E6E0D6]">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                onChangeScopeId('all');
                setSelectedTags([]);
              }}
              className={`min-h-[40px] sm:min-h-[34px] px-3.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg sm:rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                activeScopeId === 'all'
                  ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                  : 'bg-white text-[#57534E] border-[#D6CEBE] hover:border-[#1C1917] hover:text-[#1C1917]'
              }`}
            >
              全範囲（{cards.filter((c) => !c.suspended).length}）
            </button>
            {scopes.map((scope) => {
              const isSelected = activeScopeId === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => {
                    onChangeScopeId(scope.id);
                    setSelectedTags([]);
                  }}
                  className={`min-h-[40px] sm:min-h-[34px] px-3.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg sm:rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                      : 'bg-white text-[#57534E] border-[#D6CEBE] hover:border-[#1C1917] hover:text-[#1C1917]'
                  }`}
                >
                  {scope.name}（{cardCountsByScope[scope.id] ?? 0}）
                </button>
              );
            })}
          </div>
          {activeScope?.description && (
            <p className="text-xs text-[#57534E] leading-relaxed">{activeScope.description}</p>
          )}
        </div>

        <div className="grid grid-cols-3 sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenScopeManager}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[36px] px-2.5 sm:px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5 text-[#57534E] shrink-0" aria-hidden="true" />
            <span>範囲管理</span>
          </button>
          <button
            type="button"
            onClick={onOpenBulkImport}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[36px] px-2.5 sm:px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-[#9A3412] shrink-0" aria-hidden="true" />
            <span>一括追加</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddCard}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-2 text-xs font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>1問追加</span>
          </button>
        </div>
      </section>

      {/* Hero Review Action Banner + 4 KPI Strip */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-4 sm:p-6 space-y-5 sm:space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-[#9A3412]">
              忘却曲線スペースド・リピティション（SM-2）
            </div>
            <h2 className="text-xl sm:text-3xl font-serif font-bold text-[#1C1917]">
              {activeScope ? activeScope.name : 'すべての考査範囲'}
            </h2>
            <p className="text-xs sm:text-sm text-[#57534E] max-w-2xl leading-relaxed">
              {scopeStats.due > 0
                ? `忘却曲線にもとづき、現在 ${scopeStats.due} 問が復習の最適タイミングを迎えています。`
                : scopeStats.newCount > 0
                  ? `今日の復習待ちは完了しています。未学習の ${scopeStats.newCount} 問から新しいカードを学習できます。`
                  : 'すべてのカードを学習済みです。試験前集中演習や弱点タグ復習で定着度を高めましょう。'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 shrink-0">
            {scopeStats.due > 0 ? (
              <button
                type="button"
                onClick={() =>
                  launchQuickPreset('due', 'flip', {
                    label: `${activeScope?.name ?? '全範囲'} · 今日の忘却曲線復習`,
                  })
                }
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 text-sm font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] active:scale-[0.99] rounded-xl sm:rounded-md transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                今日の復習を開始（{scopeStats.due}問）
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  launchQuickPreset(
                    scopeStats.newCount > 0 ? 'new' : 'all',
                    'flip',
                    {
                      label:
                        scopeStats.newCount > 0
                          ? `${activeScope?.name ?? '全範囲'} · 未学習カード`
                          : `${activeScope?.name ?? '全範囲'} · 全問復習`,
                    }
                  )
                }
                disabled={scopeStats.total === 0}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 text-sm font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] active:scale-[0.99] disabled:opacity-40 rounded-xl sm:rounded-md transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                {scopeStats.newCount > 0
                  ? `未学習から開始（${scopeStats.newCount}問）`
                  : `全問カード開始（${scopeStats.total}問）`}
              </button>
            )}

            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  launchQuickPreset('all', 'redsheet', {
                    label: `${activeScope?.name ?? '全範囲'} · 赤シート総ざらい`,
                  })
                }
                disabled={scopeStats.total === 0}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] disabled:opacity-40 rounded-xl sm:rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Eye className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                赤シート
              </button>
              <button
                type="button"
                onClick={() =>
                  launchQuickPreset('all', 'typing', {
                    label: `${activeScope?.name ?? '全範囲'} · 記述テスト`,
                  })
                }
                disabled={scopeStats.total === 0}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 text-xs sm:text-sm font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] disabled:opacity-40 rounded-xl sm:rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <PenLine className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                記述チェック
              </button>
            </div>
          </div>
        </div>

        {/* 4-column metric strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 pt-4 sm:pt-5 border-t border-[#E6E0D6]">
          <div className="space-y-0.5">
            <div className="text-[11px] sm:text-xs text-[#57534E]">復習待ち（忘却曲線）</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#9A3412]">
              {scopeStats.due}
              <span className="text-xs font-sans font-normal text-[#78716C] ml-1">問</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">
              本日解答: <span className="font-mono tabular-nums">{todayReviews}</span> 回
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] sm:text-xs text-[#57534E]">学習進捗（総問題数）</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#1C1917]">
              {scopeStats.learned}
              <span className="text-sm font-normal text-[#78716C]"> / {scopeStats.total}</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">
              未学習: <span className="font-mono tabular-nums">{scopeStats.newCount}</span> 問
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] sm:text-xs text-[#57534E]">推定記憶保持率</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#15803D]">
              {scopeStats.avgRetention !== null ? `${scopeStats.avgRetention}%` : '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">
              長期定着: <span className="font-mono tabular-nums">{scopeStats.mastered}</span> 問
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] sm:text-xs text-[#57534E]">連続学習・苦手</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#1C1917]">
              {streakDays}
              <span className="text-xs font-sans font-normal text-[#78716C] ml-1">日連続</span>
            </div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">
              苦手: <span className="font-mono tabular-nums">{scopeStats.weak}</span> · 星: <span className="font-mono tabular-nums">{scopeStats.starred}</span>
            </div>
          </div>
        </div>

        {/* Quick Preset Launch Strip (horizontally scrollable on mobile) */}
        <div className="pt-4 border-t border-[#E6E0D6] flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          <span className="text-xs font-medium text-[#57534E] shrink-0">クイック:</span>
          <button
            type="button"
            onClick={() =>
              onLaunchSession({
                scopeId: activeScopeId,
                chapter: 'all',
                unit: 'all',
                selectedTags: ['重要度_最重要'],
                tagMatchMode: 'and',
                filterPreset: 'all',
                orderMode: 'unit',
                swapFrontBack: false,
                recordToSrs: true,
                mode: 'flip',
                label: '重要度：最重要のみ集中演習',
              })
            }
            className="min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            最重要のみ（{scopeCards.filter((c) => c.tags.includes('重要度_最重要')).length}）
          </button>
          <button
            type="button"
            disabled={scopeStats.weak === 0}
            onClick={() =>
              launchQuickPreset('weak', 'flip', {
                orderMode: 'srs',
                label: '苦手・要復習カード集中演習',
              })
            }
            className="min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            苦手のみ（{scopeStats.weak}）
          </button>
          <button
            type="button"
            disabled={scopeStats.starred === 0}
            onClick={() =>
              launchQuickPreset('starred', 'flip', {
                label: 'ブックマーク済み問題',
              })
            }
            className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Star className="w-3 h-3 text-[#B45309]" aria-hidden="true" />
            星付き（{scopeStats.starred}）
          </button>
          <button
            type="button"
            disabled={scopeStats.total === 0}
            onClick={() =>
              launchQuickPreset('all', 'flip', {
                orderMode: 'shuffle',
                label: '全問シャッフル演習',
              })
            }
            className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Shuffle className="w-3 h-3 text-[#57534E]" aria-hidden="true" />
            全問シャッフル
          </button>
          <button
            type="button"
            disabled={scopeStats.total === 0}
            onClick={() =>
              launchQuickPreset('all', 'flip', {
                swapFrontBack: true,
                orderMode: 'shuffle',
                label: '表裏反転（用語→説明）演習',
              })
            }
            className="min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            表裏反転
          </button>
        </div>
      </section>

      {/* Mobile-only Section Switcher: Instant 1-tap toggle between Chapter/Unit and Tag Explorer */}
      <div
        role="tablist"
        aria-label="出題範囲の選び方"
        className="lg:hidden grid grid-cols-2 gap-1 p-1 bg-[#F4F0E8] rounded-xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileBrowseTab === 'units'}
          onClick={() => setMobileBrowseTab('units')}
          className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            mobileBrowseTab === 'units'
              ? 'bg-white text-[#1C1917] shadow-xs'
              : 'text-[#57534E]'
          }`}
        >
          <Layers className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
          章・単元から選ぶ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileBrowseTab === 'tags'}
          onClick={() => setMobileBrowseTab('tags')}
          className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
            mobileBrowseTab === 'tags'
              ? 'bg-white text-[#1C1917] shadow-xs'
              : 'text-[#57534E]'
          }`}
        >
          <Tag className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
          タグ別学習{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
        </button>
      </div>

      {/* Main 2-column Hub (Desktop side-by-side / Mobile tab-switched) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left 7 cols: Chapter & Unit Breakdown */}
        <section
          className={`lg:col-span-7 space-y-4 ${
            mobileBrowseTab === 'units' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-serif font-bold text-[#1C1917] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
              章・単元から学習する
            </h3>
            <span className="text-xs text-[#78716C] font-mono tabular-nums">
              全 {chapterGroups.reduce((sum, ch) => sum + ch.units.length, 0)} 単元
            </span>
          </div>

          {chapterGroups.length === 0 ? (
            <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-8 text-center text-sm text-[#57534E]">
              この考査範囲にはまだ問題が登録されていません。「1問追加」または「一括追加」から登録できます。
            </div>
          ) : (
            <div className="space-y-4">
              {chapterGroups.map((group) => {
                const isCollapsed = Boolean(collapsedChapters[group.chapter]);
                const chapterPct =
                  group.total > 0 ? Math.round((group.learned / group.total) * 100) : 0;
                return (
                  <div
                    key={group.chapter}
                    className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg overflow-hidden"
                  >
                    {/* Chapter Header */}
                    <div className="px-4 py-3 bg-[#FBF9F5] border-b border-[#E6E0D6] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedChapters((prev) => ({
                            ...prev,
                            [group.chapter]: !prev[group.chapter],
                          }))
                        }
                        className="flex items-center gap-2 text-left min-w-0 flex-1 min-h-[44px]"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-[#78716C] shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#78716C] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-serif font-bold text-[#1C1917] leading-snug">
                            {group.chapter}
                          </div>
                          <div className="text-xs text-[#78716C] flex items-center gap-2 font-mono tabular-nums mt-0.5">
                            <span>{group.total}問</span>
                            <span aria-hidden="true">·</span>
                            <span>学習済 {chapterPct}%</span>
                            {group.due > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#9A3412] font-medium">
                                  復習 {group.due}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onLaunchSession({
                            scopeId: activeScopeId,
                            chapter: group.chapter,
                            unit: 'all',
                            selectedTags: [],
                            tagMatchMode: 'and',
                            filterPreset: 'all',
                            orderMode: 'unit',
                            swapFrontBack: false,
                            recordToSrs: true,
                            mode: 'flip',
                            label: group.chapter,
                          })
                        }
                        className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        章ごと
                      </button>
                    </div>

                    {/* Units list */}
                    {!isCollapsed && (
                      <div className="divide-y divide-[#E6E0D6]">
                        {group.units.map((u) => {
                          const learnedPct =
                            u.total > 0 ? Math.round((u.learned / u.total) * 100) : 0;
                          const masteredPct =
                            u.total > 0 ? Math.round((u.mastered / u.total) * 100) : 0;

                          return (
                            <div
                              key={`${group.chapter}-${u.unit}`}
                              className="p-4 hover:bg-[#FBF9F5]/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="text-sm font-medium text-[#1C1917] leading-snug">
                                  {u.unit}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#78716C] font-mono tabular-nums">
                                  <span>{u.total}問</span>
                                  <span aria-hidden="true">·</span>
                                  <span>済 {u.learned}/{u.total}</span>
                                  {u.due > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-[#9A3412] font-medium">
                                        復習 {u.due}
                                      </span>
                                    </>
                                  )}
                                  {u.weak > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-[#B45309]">苦手 {u.weak}</span>
                                    </>
                                  )}
                                  {u.avgRetention !== null && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>保持 {u.avgRetention}%</span>
                                    </>
                                  )}
                                </div>
                                <div className="h-1.5 w-full sm:max-w-xs bg-[#F4F0E8] rounded-full overflow-hidden relative">
                                  <div
                                    className="h-full bg-[#D97706]/55 transition-all"
                                    style={{ width: `${learnedPct}%` }}
                                  />
                                  <div
                                    className="h-full bg-[#15803D] absolute top-0 left-0 transition-all"
                                    style={{ width: `${masteredPct}%` }}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onLaunchSession({
                                      scopeId: activeScopeId,
                                      chapter: group.chapter,
                                      unit: u.unit,
                                      selectedTags: [],
                                      tagMatchMode: 'and',
                                      filterPreset: u.due > 0 ? 'due' : 'all',
                                      orderMode: u.due > 0 ? 'srs' : 'unit',
                                      swapFrontBack: false,
                                      recordToSrs: true,
                                      mode: 'flip',
                                      label: u.unit,
                                    })
                                  }
                                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
                                >
                                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                                  {u.due > 0 ? `復習 (${u.due})` : 'カード学習'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onLaunchSession({
                                      scopeId: activeScopeId,
                                      chapter: group.chapter,
                                      unit: u.unit,
                                      selectedTags: [],
                                      tagMatchMode: 'and',
                                      filterPreset: 'all',
                                      orderMode: 'unit',
                                      swapFrontBack: false,
                                      recordToSrs: true,
                                      mode: 'redsheet',
                                      label: `${u.unit} · 赤シート`,
                                    })
                                  }
                                  className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
                                >
                                  赤シート
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right 5 cols: Multi-Axis Tag Study Builder */}
        <aside
          className={`lg:col-span-5 bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-4 sm:p-5 space-y-4 lg:sticky lg:top-20 ${
            mobileBrowseTab === 'tags' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-serif font-bold text-[#1C1917] flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
              タグで絞り込んで学習
            </h3>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="min-h-[36px] px-2 text-xs text-[#9A3412] font-medium hover:underline whitespace-nowrap"
              >
                選択解除（{selectedTags.length}）
              </button>
            )}
          </div>

          <p className="text-xs text-[#57534E]">
            重要度・分類・地域・授業タグを選ぶと、該当する問題だけを抽出して学習できます。
          </p>

          {/* Search & AND/OR segmented toggle */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="タグを検索（例：条約、日本）"
              className="flex-1 h-11 sm:h-9 px-3 text-base sm:text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg sm:rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
            <div
              role="group"
              aria-label="複数タグの結合条件"
              className="flex items-center p-1 sm:p-0.5 bg-[#F4F0E8] rounded-lg sm:rounded-md shrink-0"
            >
              <button
                type="button"
                onClick={() => setTagMatchMode('and')}
                className={`min-h-[36px] sm:min-h-[28px] px-3 sm:px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  tagMatchMode === 'and'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                AND
              </button>
              <button
                type="button"
                onClick={() => setTagMatchMode('or')}
                className={`min-h-[36px] sm:min-h-[28px] px-3 sm:px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  tagMatchMode === 'or'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                OR
              </button>
            </div>
          </div>

          {/* Selected tags launch box */}
          <div className="p-3.5 bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl sm:rounded-md space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#57534E]">
                {selectedTags.length === 0
                  ? 'タグ未選択（範囲全体）'
                  : `選択中: ${selectedTags.length}件（${tagMatchMode === 'and' ? 'すべて含む' : 'いずれか'}）`}
              </span>
              <span className="font-mono font-semibold tabular-nums text-[#1C1917]">
                該当 {matchedBySelectedTags.length} 問
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
              <button
                type="button"
                disabled={matchedBySelectedTags.length === 0}
                onClick={() => launchTagStudy('flip', 'all')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 py-2 text-xs font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                カード学習（{matchedBySelectedTags.length}問）
              </button>
              <div className="grid grid-cols-2 sm:flex items-center gap-2">
                {matchedDueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => launchTagStudy('flip', 'due')}
                    className="col-span-2 sm:col-span-1 min-h-[44px] sm:min-h-[36px] px-3 py-2 text-xs font-medium text-[#9A3412] bg-white border border-[#9A3412] hover:bg-[#9A3412]/5 rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
                  >
                    復習待ち（{matchedDueCount}）
                  </button>
                )}
                <button
                  type="button"
                  disabled={matchedBySelectedTags.length === 0}
                  onClick={() => launchTagStudy('redsheet', 'all')}
                  className="min-h-[44px] sm:min-h-[36px] px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
                >
                  赤シート
                </button>
                <button
                  type="button"
                  disabled={matchedBySelectedTags.length === 0}
                  onClick={() => launchTagStudy('typing', 'all')}
                  className="min-h-[44px] sm:min-h-[36px] px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] disabled:opacity-40 rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
                >
                  記述
                </button>
              </div>
            </div>
          </div>

          {/* Grouped Tag Lists (larger tap chips on mobile) */}
          <div className="space-y-3 lg:max-h-[540px] lg:overflow-y-auto archival-scroll lg:pr-1">
            {filteredTagGroups.map((group) => {
              const isOpen =
                Boolean(expandedTagCategories[group.key]) || tagSearch.trim().length > 0;
              return (
                <div
                  key={group.key}
                  className="border-t border-[#E6E0D6] pt-3 first:border-t-0 first:pt-0"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTagCategories((prev) => ({
                        ...prev,
                        [group.key]: !prev[group.key],
                      }))
                    }
                    className="w-full min-h-[40px] sm:min-h-[32px] flex items-center justify-between text-xs font-medium text-[#57534E] hover:text-[#1C1917] mb-1.5"
                  >
                    <span className="flex items-center gap-1.5">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      )}
                      {group.label}
                    </span>
                    <span className="font-mono tabular-nums text-[#78716C]">
                      {group.items.length}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="flex flex-wrap gap-2 sm:gap-1.5">
                      {group.items.map((item) => {
                        const active = selectedTags.includes(item.meta.raw);
                        return (
                          <button
                            key={item.meta.raw}
                            type="button"
                            onClick={() => toggleTag(item.meta.raw)}
                            className={`inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-[32px] px-3 sm:px-2.5 py-1.5 text-xs rounded-lg sm:rounded-md border transition-colors text-left max-w-full ${
                              active
                                ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                                : 'bg-[#FBF9F5] text-[#1C1917] border-[#E6E0D6] hover:border-[#1C1917]'
                            }`}
                          >
                            <span className="truncate max-w-[230px]">
                              {item.meta.displayLabel}
                            </span>
                            <span
                              className={`font-mono text-[11px] tabular-nums shrink-0 ${
                                active ? 'text-[#D6CEBE]' : 'text-[#78716C]'
                              }`}
                            >
                              {item.total}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Mobile Floating Tag Selection Action Bar (appears when tags are selected on mobile) */}
      {mobileBrowseTab === 'tags' && selectedTags.length > 0 && (
        <div className="lg:hidden fixed left-3 right-3 bottom-18 z-20 bg-[#1C1917] text-[#FBF9F5] rounded-xl px-4 py-2.5 shadow-lg flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">
              {selectedTags.length}件のタグを選択中
            </div>
            <div className="text-[11px] font-mono tabular-nums text-[#D6CEBE]">
              該当 {matchedBySelectedTags.length} 問（{tagMatchMode.toUpperCase()}）
            </div>
          </div>
          <button
            type="button"
            disabled={matchedBySelectedTags.length === 0}
            onClick={() => launchTagStudy('flip', 'all')}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 text-xs font-semibold text-[#FBF9F5] bg-[#9A3412] active:bg-[#7C2D12] disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            学習開始
          </button>
        </div>
      )}
    </div>
  );
}
