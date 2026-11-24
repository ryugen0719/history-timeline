import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { INITIAL_FLASHCARDS } from '../../data/initialFlashcards';
import type {
  ExamScope,
  Flashcard,
  SrsProgressMap,
} from '../../types/flashcards';
import { parseTagMeta } from '../../utils/flashcardParser';
import {
  getCardStatusLabel,
  getSrsProgress,
  isCardDue,
  isCardMastered,
  isCardWeak,
} from '../../utils/srsEngine';

interface CardManageViewProps {
  scopes: ExamScope[];
  cards: Flashcard[];
  srsMap: SrsProgressMap;
  activeScopeId: string;
  onChangeScopeId: (scopeId: string) => void;
  onOpenAddCard: () => void;
  onEditCard: (card: Flashcard) => void;
  onDeleteCard: (cardId: string) => void;
  onToggleStar: (cardId: string) => void;
  onToggleSuspend: (cardId: string) => void;
  onResetCardSrs: (cardId: string) => void;
  onOpenBulkImport: () => void;
  onOpenScopeManager: () => void;
  onExportCsv: (cardsToExport: Flashcard[]) => void;
  onExportBackupJson: () => void;
  onRestoreInitialTerm3: () => void;
}

type StatusFilter = 'all' | 'due' | 'new' | 'weak' | 'mastered' | 'starred' | 'suspended';

export function CardManageView({
  scopes,
  cards,
  srsMap,
  activeScopeId,
  onChangeScopeId,
  onOpenAddCard,
  onEditCard,
  onDeleteCard,
  onToggleStar,
  onToggleSuspend,
  onResetCardSrs,
  onOpenBulkImport,
  onOpenScopeManager,
  onExportCsv,
  onExportBackupJson,
  onRestoreInitialTerm3,
}: CardManageViewProps) {
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hideAnswers, setHideAnswers] = useState(false);

  // Progressive disclosure toggles
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRowMenuId, setExpandedRowMenuId] = useState<string | null>(null);
  const [showDataTools, setShowDataTools] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);

  const nowMs = Date.now();

  const scopeCards = useMemo(
    () =>
      cards.filter((c) => activeScopeId === 'all' || c.scopeId === activeScopeId),
    [cards, activeScopeId]
  );

  const availableUnits = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of scopeCards) {
      if (!seen.has(c.unit)) {
        seen.add(c.unit);
        list.push(c.unit);
      }
    }
    return list;
  }, [scopeCards]);

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of scopeCards) {
      for (const t of c.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
      .map(([tag, count]) => ({ tag, count }));
  }, [scopeCards]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopeCards.filter((card) => {
      if (selectedUnit !== 'all' && card.unit !== selectedUnit) return false;
      if (selectedTag !== 'all' && !card.tags.includes(selectedTag)) return false;

      const prog = getSrsProgress(srsMap, card.id);
      if (statusFilter === 'due' && !isCardDue(prog, nowMs)) return false;
      if (statusFilter === 'new' && prog.state !== 'new') return false;
      if (statusFilter === 'weak' && !isCardWeak(prog, nowMs)) return false;
      if (statusFilter === 'mastered' && !isCardMastered(prog)) return false;
      if (statusFilter === 'starred' && !card.starred) return false;
      if (statusFilter === 'suspended' && !card.suspended) return false;

      if (q) {
        const hay = `${card.number} ${card.chapter} ${card.unit} ${card.front} ${card.back} ${card.tags.join(' ')} ${card.note ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scopeCards, selectedUnit, selectedTag, statusFilter, search, srsMap, nowMs]);

  const visibleCards = filteredCards.slice(0, visibleLimit);

  const activeFilterCount =
    (selectedUnit !== 'all' ? 1 : 0) +
    (selectedTag !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* TIER 1: Primary Add Actions + Clean Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-serif font-bold text-[#1C1917]">
            問題一覧・追加
          </h2>
          <p className="text-xs text-[#78716C] font-mono tabular-nums mt-0.5">
            表示 {filteredCards.length} 問 / 全体 {cards.length} 問
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAddCard}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 text-xs font-semibold text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            1問追加
          </button>
          <button
            type="button"
            onClick={onOpenBulkImport}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
            CSV一括追加
          </button>
        </div>
      </div>

      {/* Search + Collapsible Filter Drawer */}
      <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-3.5 space-y-3">
        <div className="flex items-center gap-2">
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
                setVisibleLimit(50);
              }}
              placeholder="問題・解答・タグを検索..."
              className="w-full h-11 sm:h-10 pl-9 pr-3 text-base sm:text-sm bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl sm:rounded-lg text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            aria-expanded={showFilters}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[40px] px-3.5 text-xs font-medium rounded-xl sm:rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              showFilters || activeFilterCount > 0
                ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                : 'bg-[#FBF9F5] text-[#1C1917] border-[#E6E0D6]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            絞込{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {/* TIER 2 (Collapsible): Advanced Filters & Answer Mask */}
        {showFilters && (
          <div className="pt-3 border-t border-[#F4F0E8] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                aria-label="考査範囲"
                value={activeScopeId}
                onChange={(e) => {
                  onChangeScopeId(e.target.value);
                  setSelectedUnit('all');
                  setSelectedTag('all');
                  setVisibleLimit(50);
                }}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl sm:rounded-lg text-[#1C1917]"
              >
                <option value="all">すべての考査範囲</option>
                {scopes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="単元"
                value={selectedUnit}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  setVisibleLimit(50);
                }}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl sm:rounded-lg text-[#1C1917]"
              >
                <option value="all">すべての単元</option>
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <select
                aria-label="タグ"
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setVisibleLimit(50);
                }}
                className="w-full h-11 sm:h-9 px-3 text-base sm:text-xs bg-[#FBF9F5] border border-[#E6E0D6] rounded-xl sm:rounded-lg text-[#1C1917]"
              >
                <option value="all">すべてのタグ</option>
                {availableTags.map((item) => (
                  <option key={item.tag} value={item.tag}>
                    {item.tag} ({item.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:flex-wrap">
                {(
                  [
                    { id: 'all', label: 'すべて' },
                    { id: 'due', label: '復習待ち' },
                    { id: 'new', label: '未学習' },
                    { id: 'weak', label: '苦手' },
                    { id: 'mastered', label: '長期定着' },
                    { id: 'starred', label: '星付き' },
                    { id: 'suspended', label: '一時停止' },
                  ] as Array<{ id: StatusFilter; label: string }>
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st.id);
                      setVisibleLimit(50);
                    }}
                    className={`min-h-[36px] sm:min-h-[30px] px-3 py-1 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      statusFilter === st.id
                        ? 'bg-[#1C1917] text-[#FBF9F5]'
                        : 'bg-[#F4F0E8] text-[#57534E]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setHideAnswers((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[30px] px-3 text-xs font-medium text-[#57534E] bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg whitespace-nowrap shrink-0"
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
        )}
      </div>

      {/* Clean Card List (Only ★, Edit, and ⋯ Overflow per Row) */}
      <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl divide-y divide-[#E6E0D6]">
        {visibleCards.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#57534E]">
            条件に一致する問題がありません。
          </div>
        ) : (
          visibleCards.map((card) => {
            const prog = getSrsProgress(srsMap, card.id);
            const status = getCardStatusLabel(prog, nowMs);
            const isMenuOpen = expandedRowMenuId === card.id;

            return (
              <div
                key={card.id}
                className={`p-4 sm:px-5 space-y-2.5 ${card.suspended ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#78716C]">
                      <span className="font-mono tabular-nums text-[#57534E]">
                        No.{card.number}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[200px] sm:max-w-[280px]">
                        {card.unit}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          status.tone === 'due'
                            ? 'text-[#9A3412] font-medium'
                            : status.tone === 'mastered'
                              ? 'text-[#15803D] font-medium'
                              : ''
                        }
                      >
                        {status.label}
                      </span>
                      {card.suspended && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#991B1B]">停止中</span>
                        </>
                      )}
                    </div>

                    <p className="text-[15px] sm:text-sm text-[#1C1917] leading-relaxed">
                      {card.front}
                    </p>

                    <div className="text-[15px] sm:text-sm font-serif font-semibold text-[#9A3412]">
                      {hideAnswers ? (
                        <span className="inline-block px-2 py-0.5 bg-[#E6E0D6] text-transparent rounded select-none">
                          解答マスク中
                        </span>
                      ) : (
                        card.back
                      )}
                    </div>

                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#78716C]">
                        {card.tags.slice(0, 5).map((t, idx) => (
                          <span key={t} className="inline-flex items-center gap-1.5">
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>{parseTagMeta(t).displayLabel}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Minimal 3-Action Row Control */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleStar(card.id)}
                      aria-label="ブックマーク"
                      className={`min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                        card.starred
                          ? 'text-[#B45309] bg-[#FFFBEB]'
                          : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4F0E8]'
                      }`}
                    >
                      <Star
                        className={`w-4 h-4 ${card.starred ? 'fill-current' : ''}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCard(card)}
                      aria-label="編集"
                      className="min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded-lg transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRowMenuId(isMenuOpen ? null : card.id)
                      }
                      aria-label="その他の操作"
                      aria-expanded={isMenuOpen}
                      className={`min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                        isMenuOpen
                          ? 'bg-[#F4F0E8] text-[#1C1917]'
                          : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4F0E8]'
                      }`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Secondary Row Actions (Expanded on demand) */}
                {isMenuOpen && (
                  <div className="pt-2 border-t border-[#F4F0E8] flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onToggleSuspend(card.id);
                        setExpandedRowMenuId(null);
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 text-xs font-medium text-[#57534E] bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg"
                    >
                      {card.suspended ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 text-[#15803D]" />
                          出題を再開
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" />
                          出題を一時停止
                        </>
                      )}
                    </button>
                    {prog.state !== 'new' && (
                      <button
                        type="button"
                        onClick={() => {
                          onResetCardSrs(card.id);
                          setExpandedRowMenuId(null);
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[38px] px-3 text-xs font-medium text-[#57534E] bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        学習履歴をリセット
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteCard(card.id);
                        setExpandedRowMenuId(null);
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      削除
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Load More */}
      {filteredCards.length > visibleLimit && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + 60)}
            className="w-full sm:w-auto min-h-[44px] px-5 text-xs font-medium text-[#1C1917] bg-white border border-[#E6E0D6] hover:border-[#1C1917] rounded-xl sm:rounded-lg transition-colors"
          >
            さらに表示する（残り {filteredCards.length - visibleLimit} 問）
          </button>
        </div>
      )}

      {/* TIER 2 (Collapsible): Scope Management, Backup & Data Restore */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDataTools((prev) => !prev)}
          aria-expanded={showDataTools}
          className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left hover:bg-[#FBF9F5] transition-colors"
        >
          <span className="text-sm font-medium text-[#57534E]">
            考査範囲・バックアップ・データ管理
          </span>
          {showDataTools ? (
            <ChevronDown className="w-4 h-4 text-[#78716C]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#78716C]" />
          )}
        </button>

        {showDataTools && (
          <div className="p-5 border-t border-[#F4F0E8] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={onOpenScopeManager}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
              >
                <FolderPlus className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                考査範囲を管理
              </button>
              <button
                type="button"
                onClick={() => onExportCsv(filteredCards)}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                CSV書き出し
              </button>
              <button
                type="button"
                onClick={onExportBackupJson}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#E6E0D6] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-[#57534E]" aria-hidden="true" />
                JSONバックアップ
              </button>
            </div>

            <div className="pt-3 border-t border-[#F4F0E8] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#78716C]">
              <span>
                第3回定期考査（初期{INITIAL_FLASHCARDS.length}問）を初期状態に戻す
              </span>
              {confirmRestore ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreInitialTerm3();
                      setConfirmRestore(false);
                    }}
                    className="min-h-[38px] px-3.5 text-xs font-medium text-white bg-[#9A3412] rounded-lg whitespace-nowrap"
                  >
                    {INITIAL_FLASHCARDS.length}問を復元実行
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(false)}
                    className="min-h-[38px] px-3 text-xs text-[#57534E]"
                  >
                    キャンセル
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRestore(true)}
                  className="text-left sm:text-right text-xs text-[#57534E] hover:text-[#9A3412] underline whitespace-nowrap"
                >
                  初期{INITIAL_FLASHCARDS.length}問を再復元
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
