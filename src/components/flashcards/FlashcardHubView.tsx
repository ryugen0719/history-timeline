import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  ListOrdered,
  PenLine,
  Play,
  RotateCw,
  Search,
  Shuffle,
  Star,
  X,
} from 'lucide-react';
import type {
  ExamScope,
  Flashcard,
  HubLaunchPrefs,
  PersistedStudySession,
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
import { parseTagMeta } from '../../utils/flashcardParser';
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
  todayReviews: number;
  hubPrefs: HubLaunchPrefs;
  savedSession: PersistedStudySession | null;
  onChangeHubPrefs: (prefs: HubLaunchPrefs) => void;
  onChangeScopeId: (scopeId: string) => void;
  onLaunchSession: (config: StudySessionConfig) => void;
  onResumeSession: () => void;
  onDiscardSavedSession: () => void;
  onGoToManage: () => void;
}

const HUB_MODE_OPTIONS: Array<{ id: StudyMode; label: string }> = [
  { id: 'flip', label: 'カード' },
  { id: 'typing', label: '記述' },
  { id: 'redsheet', label: '赤シート' },
];

export function FlashcardHubView({
  scopes,
  cards,
  srsMap,
  activeScopeId,
  todayReviews,
  hubPrefs,
  savedSession,
  onChangeHubPrefs,
  onChangeScopeId,
  onLaunchSession,
  onResumeSession,
  onDiscardSavedSession,
  onGoToManage,
}: FlashcardHubViewProps) {
  const [browseTab, setBrowseTab] = useState<'units' | 'tags'>('units');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Tag selection state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>('and');
  const [tagSearch, setTagSearch] = useState('');
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

  const mostImportantCount = useMemo(
    () => scopeCards.filter((c) => c.tags.includes('重要度_最重要')).length,
    [scopeCards]
  );

  const activeScope = scopes.find((s) => s.id === activeScopeId);

  const toggleTag = (rawTag: string) => {
    setSelectedTags((prev) =>
      prev.includes(rawTag) ? prev.filter((t) => t !== rawTag) : [...prev, rawTag]
    );
  };

  const launchQuickPreset = (
    filterPreset: StudyFilterPreset,
    mode: StudyMode = hubPrefs.mode,
    extra?: Partial<StudySessionConfig>
  ) => {
    onLaunchSession({
      scopeId: activeScopeId,
      chapter: 'all',
      unit: 'all',
      selectedTags: [],
      tagMatchMode: 'and',
      filterPreset,
      orderMode:
        filterPreset === 'due'
          ? 'srs'
          : hubPrefs.orderMode,
      swapFrontBack: false,
      recordToSrs: true,
      mode,
      ...extra,
    });
  };

  const launchTagStudy = (
    mode: StudyMode = hubPrefs.mode,
    filterPreset: StudyFilterPreset = 'all'
  ) => {
    onLaunchSession({
      scopeId: activeScopeId,
      chapter: 'all',
      unit: 'all',
      selectedTags,
      tagMatchMode,
      filterPreset,
      orderMode: filterPreset === 'due' ? 'srs' : hubPrefs.orderMode,
      swapFrontBack: false,
      recordToSrs: true,
      mode,
      label:
        selectedTags.length > 0
          ? `タグ演習（${selectedTags.length}件・${tagMatchMode.toUpperCase()}）`
          : activeScope?.name ?? '全範囲',
    });
  };

  const handlePrimaryStart = () => {
    if (scopeStats.due > 0) {
      launchQuickPreset('due', hubPrefs.mode, {
        label: `${activeScope?.name ?? '全範囲'} · 今日の復習`,
      });
    } else if (scopeStats.newCount > 0) {
      launchQuickPreset('new', hubPrefs.mode, {
        label: `${activeScope?.name ?? '全範囲'} · 未学習`,
      });
    } else {
      launchQuickPreset('all', hubPrefs.mode, {
        label: `${activeScope?.name ?? '全範囲'} · 全問復習`,
      });
    }
  };

  const primaryLabel =
    scopeStats.due > 0
      ? `今日の復習を開始（${scopeStats.due}問）`
      : scopeStats.newCount > 0
        ? `学習を開始（未学習 ${scopeStats.newCount}問）`
        : `全問を復習する（${scopeStats.total}問）`;

  const savedSessionRemaining = savedSession
    ? savedSession.config.mode === 'redsheet'
      ? Math.max(
          0,
          savedSession.queueIds.length -
            Object.keys(savedSession.redSheetRated).length
        )
      : Math.max(0, savedSession.queueIds.length - savedSession.currentIndex)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Quick Resume Strip when an in-progress session exists */}
      {savedSession && savedSessionRemaining > 0 && (
        <section
          aria-label="前回の続きから再開"
          className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl sm:rounded-xl px-4 py-3 sm:px-5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-[#92400E]">
              前回の続きから再開できます
            </div>
            <div className="text-sm font-serif font-bold text-[#1C1917] truncate mt-0.5">
              {savedSession.config.label || '一問一答'}
              <span className="ml-2 text-xs font-mono font-normal tabular-nums text-[#78716C]">
                {savedSession.config.mode === 'redsheet'
                  ? `未評価 ${savedSessionRemaining}/${savedSession.queueIds.length}問`
                  : `${savedSession.currentIndex + 1}/${savedSession.queueIds.length}問目`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onResumeSession}
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[36px] px-3.5 text-xs font-semibold text-[#92400E] bg-white hover:bg-[#FEF3C7] border border-[#F59E0B] rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
              続きから再開
            </button>
            <button
              type="button"
              onClick={onDiscardSavedSession}
              aria-label="前回の続きをクリア"
              className="min-h-[40px] min-w-[36px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center text-[#92400E] hover:text-[#1C1917] hover:bg-[#FEF3C7] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}
      {/* TIER 1: Single Primary Study Hero */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            {scopes.length > 1 ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label="試験範囲を選択"
                  value={activeScopeId}
                  onChange={(e) => {
                    onChangeScopeId(e.target.value);
                    setSelectedTags([]);
                  }}
                  className="text-xl sm:text-2xl font-serif font-bold text-[#1C1917] bg-transparent border-b border-dashed border-[#D6CEBE] pb-0.5 pr-2 focus:outline-none focus:border-[#9A3412] max-w-full cursor-pointer"
                >
                  {scopes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="all">すべての考査範囲</option>
                </select>
              </div>
            ) : (
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1917]">
                {activeScope ? activeScope.name : 'すべての考査範囲'}
              </h2>
            )}

            {/* Quiet Unboxed Progress Line */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-[#57534E] font-mono tabular-nums">
              <span>
                復習待ち <strong className="text-[#9A3412] font-semibold">{scopeStats.due}</strong>
              </span>
              <span aria-hidden="true" className="text-[#D6CEBE]">
                ·
              </span>
              <span>
                学習済 {scopeStats.learned}/{scopeStats.total}
              </span>
              {scopeStats.avgRetention !== null && (
                <>
                  <span aria-hidden="true" className="text-[#D6CEBE]">
                    ·
                  </span>
                  <span>記憶保持 {scopeStats.avgRetention}%</span>
                </>
              )}
              {todayReviews > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#D6CEBE]">
                    ·
                  </span>
                  <span>本日 {todayReviews}回</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* One Dominant Primary CTA + Inline Mode & Order Preferences */}
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              disabled={scopeStats.total === 0}
              onClick={handlePrimaryStart}
              className="w-full sm:w-auto sm:min-w-[260px] inline-flex items-center justify-center gap-2 min-h-[50px] px-6 py-3 text-sm sm:text-base font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] active:scale-[0.99] disabled:opacity-40 rounded-xl sm:rounded-lg transition-all whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              {primaryLabel}
            </button>

            {/* Quick Mode & Order Selector (applies to Hero, Unit, Chapter & Tag launches) */}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <div
                role="group"
                aria-label="出題形式"
                className="flex items-center p-1 bg-[#F4F0E8] rounded-lg"
              >
                {HUB_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={hubPrefs.mode === opt.id}
                    onClick={() =>
                      onChangeHubPrefs({ ...hubPrefs, mode: opt.id })
                    }
                    className={`min-h-[36px] sm:min-h-[32px] px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      hubPrefs.mode === opt.id
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                aria-pressed={hubPrefs.orderMode === 'shuffle'}
                onClick={() =>
                  onChangeHubPrefs({
                    ...hubPrefs,
                    orderMode:
                      hubPrefs.orderMode === 'shuffle' ? 'unit' : 'shuffle',
                  })
                }
                className={`inline-flex items-center gap-1.5 min-h-[42px] sm:min-h-[38px] px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  hubPrefs.orderMode === 'shuffle'
                    ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                    : 'bg-[#FBF9F5] text-[#57534E] border-[#E6E0D6] hover:border-[#1C1917] hover:text-[#1C1917]'
                }`}
              >
                {hubPrefs.orderMode === 'shuffle' ? (
                  <>
                    <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
                    シャッフル
                  </>
                ) : (
                  <>
                    <ListOrdered className="w-3.5 h-3.5" aria-hidden="true" />
                    番号順
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quiet Secondary Shortcuts + Progressive Disclosure */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-0.5 text-xs">
            <button
              type="button"
              disabled={scopeStats.total === 0}
              onClick={() =>
                launchQuickPreset('all', 'redsheet', {
                  label: `${activeScope?.name ?? '全範囲'} · 赤シート`,
                })
              }
              className="inline-flex items-center gap-1.5 min-h-[36px] text-[#57534E] hover:text-[#1C1917] disabled:opacity-40 font-medium transition-colors whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
              全問赤シート
            </button>
            <button
              type="button"
              disabled={scopeStats.total === 0}
              onClick={() =>
                launchQuickPreset('all', 'typing', {
                  label: `${activeScope?.name ?? '全範囲'} · 記述`,
                })
              }
              className="inline-flex items-center gap-1.5 min-h-[36px] text-[#57534E] hover:text-[#1C1917] disabled:opacity-40 font-medium transition-colors whitespace-nowrap"
            >
              <PenLine className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
              全問記述
            </button>

            <button
              type="button"
              onClick={() => setShowMoreOptions((prev) => !prev)}
              aria-expanded={showMoreOptions}
              className="inline-flex items-center gap-1 min-h-[36px] text-[#57534E] hover:text-[#1C1917] font-medium transition-colors whitespace-nowrap sm:ml-auto"
            >
              <span>絞り込み出題</span>
              {showMoreOptions ? (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* TIER 2 (Collapsed by default): Extra Study Presets */}
        {showMoreOptions && (
          <div className="pt-4 border-t border-[#E6E0D6] flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={mostImportantCount === 0}
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
                  label: '最重要のみ',
                })
              }
              className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              最重要のみ（{mostImportantCount}）
            </button>
            <button
              type="button"
              disabled={scopeStats.weak === 0}
              onClick={() =>
                launchQuickPreset('weak', 'flip', {
                  orderMode: 'srs',
                  label: '苦手のみ',
                })
              }
              className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              苦手のみ（{scopeStats.weak}）
            </button>
            <button
              type="button"
              disabled={scopeStats.starred === 0}
              onClick={() =>
                launchQuickPreset('starred', 'flip', {
                  label: '星付き問題',
                })
              }
              className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
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
                  label: '全問シャッフル',
                })
              }
              className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
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
                  label: '表裏反転（用語→説明）',
                })
              }
              className="min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
            >
              表裏反転
            </button>
          </div>
        )}
      </section>

      {/* TIER 2: Single-Focus Scope Browser (単元別 | タグ別) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="範囲の選び方"
            className="grid grid-cols-2 sm:inline-flex gap-1 p-1 bg-[#F4F0E8] rounded-xl sm:rounded-lg w-full sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={browseTab === 'units'}
              onClick={() => setBrowseTab('units')}
              className={`min-h-[42px] sm:min-h-[34px] px-5 text-xs sm:text-sm font-medium rounded-lg sm:rounded-md transition-colors whitespace-nowrap ${
                browseTab === 'units'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              単元から選ぶ
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={browseTab === 'tags'}
              onClick={() => setBrowseTab('tags')}
              className={`min-h-[42px] sm:min-h-[34px] px-5 text-xs sm:text-sm font-medium rounded-lg sm:rounded-md transition-colors whitespace-nowrap ${
                browseTab === 'tags'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              タグから選ぶ{selectedTags.length > 0 ? ` (${selectedTags.length})` : ''}
            </button>
          </div>
        </div>

        {/* Units Browser: Clean Tappable Rows (No Per-Row Button Clutter) */}
        {browseTab === 'units' ? (
          chapterGroups.length === 0 ? (
            <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-8 text-center space-y-3">
              <p className="text-sm text-[#57534E]">
                この考査範囲にはまだ問題が登録されていません。
              </p>
              <button
                type="button"
                onClick={onGoToManage}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-[#9A3412] bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg hover:border-[#9A3412] transition-colors"
              >
                問題管理から追加する
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {chapterGroups.map((group) => {
                const isCollapsed = Boolean(collapsedChapters[group.chapter]);
                const chapterPct =
                  group.total > 0 ? Math.round((group.learned / group.total) * 100) : 0;

                return (
                  <div
                    key={group.chapter}
                    className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl overflow-hidden"
                  >
                    {/* Chapter Header */}
                    <div className="px-4 py-2.5 bg-[#FBF9F5] border-b border-[#E6E0D6] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedChapters((prev) => ({
                            ...prev,
                            [group.chapter]: !prev[group.chapter],
                          }))
                        }
                        className="flex items-center gap-2 text-left min-w-0 flex-1 min-h-[40px]"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-[#78716C] shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#78716C] shrink-0" />
                        )}
                        <span className="text-sm font-serif font-bold text-[#1C1917] truncate">
                          {group.chapter}
                        </span>
                        <span className="text-xs text-[#78716C] font-mono tabular-nums shrink-0">
                          {chapterPct}%
                        </span>
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
                            orderMode: hubPrefs.orderMode,
                            swapFrontBack: false,
                            recordToSrs: true,
                            mode: hubPrefs.mode,
                            label: group.chapter,
                          })
                        }
                        className="min-h-[36px] px-2.5 text-xs font-medium text-[#57534E] hover:text-[#9A3412] transition-colors whitespace-nowrap shrink-0"
                      >
                        章ごと（{group.total}）
                      </button>
                    </div>

                    {/* Clean Full-Row Tappable Units + Sibling Due Button (No Nested Buttons) */}
                    {!isCollapsed && (
                      <div className="divide-y divide-[#E6E0D6]">
                        {group.units.map((u) => {
                          const learnedPct =
                            u.total > 0 ? Math.round((u.learned / u.total) * 100) : 0;

                          return (
                            <div
                              key={`${group.chapter}-${u.unit}`}
                              className="flex items-stretch hover:bg-[#FBF9F5] transition-colors"
                            >
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
                                    orderMode: hubPrefs.orderMode,
                                    swapFrontBack: false,
                                    recordToSrs: true,
                                    mode: hubPrefs.mode,
                                    label: u.unit,
                                  })
                                }
                                className="flex-1 min-w-0 text-left px-4 py-3.5 active:bg-[#F4F0E8]/60 flex items-center justify-between gap-3 min-h-[60px]"
                              >
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="text-sm font-medium text-[#1C1917] leading-snug">
                                    {u.unit}
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-1 flex-1 max-w-[140px] bg-[#F4F0E8] rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-[#15803D]"
                                        style={{ width: `${learnedPct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-[#78716C] font-mono tabular-nums">
                                      {u.learned}/{u.total}問
                                    </span>
                                  </div>
                                </div>
                                {u.due === 0 && (
                                  <ChevronRight
                                    className="w-4 h-4 text-[#A8A29E] shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>

                              {u.due > 0 && (
                                <div className="flex items-center pr-3 pl-1 shrink-0">
                                  <button
                                    type="button"
                                    aria-label={`${u.unit}の復習待ち${u.due}問のみを学習`}
                                    onClick={() =>
                                      onLaunchSession({
                                        scopeId: activeScopeId,
                                        chapter: group.chapter,
                                        unit: u.unit,
                                        selectedTags: [],
                                        tagMatchMode: 'and',
                                        filterPreset: 'due',
                                        orderMode: 'srs',
                                        swapFrontBack: false,
                                        recordToSrs: true,
                                        mode: hubPrefs.mode,
                                        label: `${u.unit} · 復習`,
                                      })
                                    }
                                    className="min-h-[38px] px-3 text-xs font-semibold text-[#9A3412] bg-[#FFF7ED] hover:bg-[#FFEDD5] border border-[#FED7AA] rounded-lg transition-colors whitespace-nowrap font-mono tabular-nums"
                                  >
                                    復習 {u.due}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Tags Browser: Focused Tag Filtering */
          <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-4 sm:p-5 space-y-4">
            {/* Search & AND/OR */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="タグを検索..."
                  className="w-full h-11 sm:h-10 pl-9 pr-3 text-base sm:text-sm bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl sm:rounded-lg text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                />
              </div>

              <div
                role="group"
                aria-label="複数タグの結合条件"
                className="flex items-center p-1 bg-[#F4F0E8] rounded-lg shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setTagMatchMode('and')}
                  className={`min-h-[34px] sm:min-h-[30px] px-2.5 text-xs font-medium rounded-md transition-colors ${
                    tagMatchMode === 'and'
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E]'
                  }`}
                >
                  AND
                </button>
                <button
                  type="button"
                  onClick={() => setTagMatchMode('or')}
                  className={`min-h-[34px] sm:min-h-[30px] px-2.5 text-xs font-medium rounded-md transition-colors ${
                    tagMatchMode === 'or'
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E]'
                  }`}
                >
                  OR
                </button>
              </div>
            </div>

            {/* Selection Action Strip with Removable Active Tag Buttons */}
            {selectedTags.length > 0 && (
              <div className="p-3.5 bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedTags.map((rawTag) => (
                    <button
                      key={rawTag}
                      type="button"
                      onClick={() => toggleTag(rawTag)}
                      aria-label={`タグ「${parseTagMeta(rawTag).displayLabel}」の選択を解除`}
                      className="inline-flex items-center gap-1 min-h-[32px] px-2.5 text-xs font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors max-w-full"
                    >
                      <span className="truncate max-w-[180px]">
                        {parseTagMeta(rawTag).displayLabel}
                      </span>
                      <X className="w-3 h-3 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center justify-between sm:justify-start gap-3 text-xs">
                    <span className="font-mono font-semibold tabular-nums text-[#1C1917]">
                      該当 {matchedBySelectedTags.length} 問
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedTags([])}
                      className="text-[#9A3412] hover:underline"
                    >
                      すべてクリア
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={matchedBySelectedTags.length === 0}
                      onClick={() => launchTagStudy(hubPrefs.mode, 'all')}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[36px] px-4 text-xs font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      学習を開始
                    </button>
                    {matchedDueCount > 0 && (
                      <button
                        type="button"
                        onClick={() => launchTagStudy(hubPrefs.mode, 'due')}
                        className="min-h-[42px] sm:min-h-[36px] px-3 text-xs font-medium text-[#9A3412] bg-white border border-[#9A3412] rounded-lg whitespace-nowrap"
                      >
                        復習 ({matchedDueCount})
                      </button>
                    )}
                    {hubPrefs.mode !== 'redsheet' && (
                      <button
                        type="button"
                        disabled={matchedBySelectedTags.length === 0}
                        onClick={() => launchTagStudy('redsheet', 'all')}
                        className="min-h-[42px] sm:min-h-[36px] px-3 text-xs font-medium text-[#57534E] bg-white border border-[#E6E0D6] rounded-lg whitespace-nowrap"
                      >
                        赤シート
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Grouped Tags */}
            <div className="space-y-4">
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
                      className="w-full min-h-[36px] flex items-center justify-between text-xs font-medium text-[#57534E] hover:text-[#1C1917] mb-2"
                    >
                      <span className="flex items-center gap-1.5">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        {group.label}
                      </span>
                      <span className="font-mono tabular-nums text-[#78716C]">
                        {group.items.length}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const active = selectedTags.includes(item.meta.raw);
                          return (
                            <button
                              key={item.meta.raw}
                              type="button"
                              onClick={() => toggleTag(item.meta.raw)}
                              className={`inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs rounded-lg border transition-colors text-left max-w-full ${
                                active
                                  ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                                  : 'bg-[#FBF9F5] text-[#1C1917] border-[#E6E0D6] hover:border-[#1C1917]'
                              }`}
                            >
                              <span className="truncate max-w-[220px]">
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
          </div>
        )}
      </section>

      {/* Mobile Floating Tag Start Bar */}
      {browseTab === 'tags' && selectedTags.length > 0 && (
        <div className="md:hidden fixed left-3 right-3 bottom-[68px] z-20 bg-[#1C1917] text-[#FBF9F5] rounded-xl px-3.5 py-2 shadow-lg flex items-center justify-between gap-2">
          <div className="text-xs font-mono tabular-nums truncate">
            {selectedTags.length}件選択 · 該当 {matchedBySelectedTags.length} 問
          </div>
          <button
            type="button"
            disabled={matchedBySelectedTags.length === 0}
            onClick={() => launchTagStudy(hubPrefs.mode, 'all')}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 text-xs font-semibold text-[#FBF9F5] bg-[#9A3412] active:bg-[#7C2D12] disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            学習開始
          </button>
        </div>
      )}
    </div>
  );
}
