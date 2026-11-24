import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  EyeOff,
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
import type {
  ExamScope,
  Flashcard,
  SrsProgressMap,
} from '../../types/flashcards';
import { parseTagMeta } from '../../utils/flashcardParser';
import {
  calculateRetentionPercent,
  formatDueRelative,
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
  onExportCsv,
  onExportBackupJson,
  onRestoreInitialTerm3,
}: CardManageViewProps) {
  const [search, setSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hideAnswers, setHideAnswers] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(60);

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
  const activeDropdownCount =
    (activeScopeId !== 'all' ? 1 : 0) +
    (selectedUnit !== 'all' ? 1 : 0) +
    (selectedTag !== 'all' ? 1 : 0);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-[#E6E0D6]">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1917]">
            問題一覧・追加・データ管理
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] mt-0.5 font-mono tabular-nums">
            表示 {filteredCards.length} 問 / 範囲内 {scopeCards.length} 問（全体 {cards.length} 問）
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenAddCard}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3.5 py-2 text-xs font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
            1問追加
          </button>
          <button
            type="button"
            onClick={onOpenBulkImport}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
          >
            <Upload className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#9A3412]" aria-hidden="true" />
            一括追加
          </button>
          <button
            type="button"
            onClick={() => onExportCsv(filteredCards)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[36px] px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
            CSV書出
          </button>
          <button
            type="button"
            onClick={onExportBackupJson}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[36px] px-3 py-2 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-xl sm:rounded-md transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
            JSON保存
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-3.5 sm:p-4 space-y-3">
        <div className="flex items-center gap-2 lg:hidden">
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
                setVisibleLimit(60);
              }}
              placeholder="問題・解答・タグを検索..."
              className="w-full h-11 pl-9 pr-3 text-base bg-[#FBF9F5] border border-[#D6CEBE] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters((prev) => !prev)}
            className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
              showMobileFilters || activeDropdownCount > 0
                ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                : 'bg-[#FBF9F5] text-[#1C1917] border-[#D6CEBE]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            絞込{activeDropdownCount > 0 ? `(${activeDropdownCount})` : ''}
          </button>
        </div>

        <div
          className={`${
            showMobileFilters ? 'grid' : 'hidden lg:grid'
          } grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3`}
        >
          <div className="hidden lg:block lg:col-span-4 relative">
            <Search
              className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleLimit(60);
              }}
              placeholder="問題文・解答・タグ・番号を検索..."
              className="w-full h-10 pl-9 pr-3 text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="考査範囲で絞り込み"
              value={activeScopeId}
              onChange={(e) => {
                onChangeScopeId(e.target.value);
                setSelectedUnit('all');
                setSelectedTag('all');
                setVisibleLimit(60);
              }}
              className="w-full h-11 lg:h-10 px-3 lg:px-2.5 text-base lg:text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded-xl lg:rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            >
              <option value="all">すべての考査範囲</option>
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              aria-label="単元で絞り込み"
              value={selectedUnit}
              onChange={(e) => {
                setSelectedUnit(e.target.value);
                setVisibleLimit(60);
              }}
              className="w-full h-11 lg:h-10 px-3 lg:px-2.5 text-base lg:text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded-xl lg:rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            >
              <option value="all">すべての単元</option>
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-3">
            <select
              aria-label="タグで絞り込み"
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setVisibleLimit(60);
              }}
              className="w-full h-11 lg:h-10 px-3 lg:px-2.5 text-base lg:text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded-xl lg:rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
            >
              <option value="all">すべてのタグ</option>
              {availableTags.map((item) => (
                <option key={item.tag} value={item.tag}>
                  {item.tag} ({item.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status filter (horizontally scrollable on mobile) + Answer mask toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-[#E6E0D6]">
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
                  setVisibleLimit(60);
                }}
                className={`min-h-[38px] sm:min-h-[30px] px-3 sm:px-2.5 py-1 text-xs font-medium rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st.id
                    ? 'bg-[#1C1917] text-[#FBF9F5]'
                    : 'bg-[#F4F0E8] text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setHideAnswers((prev) => !prev)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] border border-[#D6CEBE] hover:border-[#1C1917] rounded-xl sm:rounded-md transition-colors whitespace-nowrap shrink-0"
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

      {/* Cards List */}
      <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg divide-y divide-[#E6E0D6]">
        {visibleCards.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#57534E]">
            条件に一致する問題がありません。検索語やフィルターをリセットしてお試しください。
          </div>
        ) : (
          visibleCards.map((card) => {
            const prog = getSrsProgress(srsMap, card.id);
            const status = getCardStatusLabel(prog, nowMs);
            const retention = calculateRetentionPercent(prog, nowMs);

            return (
              <div
                key={card.id}
                className={`p-4 sm:px-5 hover:bg-[#FBF9F5]/60 transition-colors flex flex-col lg:flex-row lg:items-start justify-between gap-3 lg:gap-4 ${
                  card.suspended ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#78716C]">
                    <span className="font-mono font-medium tabular-nums text-[#1C1917]">
                      No.{card.number}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate max-w-[220px] sm:max-w-[260px]">
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
                    {prog.state !== 'new' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          次回: {formatDueRelative(prog.dueAt, nowMs)}
                        </span>
                        {retention !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              保持 {retention}%
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {card.suspended && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#991B1B] font-medium">一時停止中</span>
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
                      {card.tags.map((t, idx) => (
                        <span key={t} className="inline-flex items-center gap-1.5">
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span>{parseTagMeta(t).displayLabel}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Row Actions (>= 44px touch hitboxes on mobile) */}
                <div className="flex items-center justify-end gap-1 pt-2 lg:pt-0 border-t border-[#F4F0E8] lg:border-t-0 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleStar(card.id)}
                    aria-label="ブックマーク切替"
                    title="ブックマーク"
                    className={`min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
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
                    title="編集"
                    className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded-lg transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleSuspend(card.id)}
                    aria-label={card.suspended ? '出題を再開' : '出題を一時停止'}
                    title={card.suspended ? '出題を再開' : '出題を一時停止'}
                    className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded-lg transition-colors"
                  >
                    {card.suspended ? (
                      <PlayCircle className="w-4 h-4 text-[#15803D]" />
                    ) : (
                      <PauseCircle className="w-4 h-4" />
                    )}
                  </button>
                  {prog.state !== 'new' && (
                    <button
                      type="button"
                      onClick={() => onResetCardSrs(card.id)}
                      aria-label="学習履歴をリセット"
                      title="この問題の学習履歴をリセット"
                      className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] flex items-center justify-center text-[#57534E] hover:text-[#9A3412] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteCard(card.id)}
                    aria-label="削除"
                    title="削除"
                    className="min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] flex items-center justify-center text-[#78716C] hover:text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Load More */}
      {filteredCards.length > visibleLimit && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => setVisibleLimit((prev) => prev + 80)}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-xl sm:rounded-md transition-colors"
          >
            さらに表示する（残り {filteredCards.length - visibleLimit} 問）
          </button>
        </div>
      )}

      {/* Initial Data Reset Safety Panel */}
      <div className="pt-4 border-t border-[#E6E0D6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#78716C]">
        <span>
          初期収録データ（第3回定期考査範囲・全310問）を誤って削除した場合、ここから元の310問を再投入できます。
        </span>
        {confirmRestore ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onRestoreInitialTerm3();
                setConfirmRestore(false);
              }}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#9A3412] rounded-lg whitespace-nowrap"
            >
              310問を復元実行
            </button>
            <button
              type="button"
              onClick={() => setConfirmRestore(false)}
              className="min-h-[40px] px-3 py-1.5 text-xs text-[#57534E] hover:text-[#1C1917]"
            >
              キャンセル
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRestore(true)}
            className="min-h-[36px] text-left sm:text-right text-xs text-[#57534E] hover:text-[#9A3412] underline whitespace-nowrap shrink-0"
          >
            第3回定期考査（全310問）を再復元
          </button>
        )}
      </div>
    </div>
  );
}
