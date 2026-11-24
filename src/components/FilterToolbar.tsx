import { useState } from 'react';
import {
  ArrowDownUp,
  Palette,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  COLOR_PALETTE,
  type ColorLabelsMap,
  type EventCategory,
  type TimelineFilters,
  type TimelineGroupMode,
  type ViewMode,
} from '../types/timeline';
import type { ColorCountsSummary } from '../utils/timelineParser';

interface FilterToolbarProps {
  datasetTitle: string;
  totalCount: number;
  filteredCount: number;
  activeView: ViewMode;
  groupMode: TimelineGroupMode;
  onChangeGroupMode: (mode: TimelineGroupMode) => void;
  availableCategories: EventCategory[];
  filters: TimelineFilters;
  colorCounts: ColorCountsSummary;
  colorLabels: ColorLabelsMap;
  onOpenColorEdit: () => void;
  onChangeFilters: (next: TimelineFilters) => void;
  onResetFilters: () => void;
}

export function FilterToolbar({
  datasetTitle,
  totalCount,
  filteredCount,
  activeView,
  groupMode,
  onChangeGroupMode,
  availableCategories,
  filters,
  colorCounts,
  colorLabels,
  onOpenColorEdit,
  onChangeFilters,
  onResetFilters,
}: FilterToolbarProps) {
  const [showMobileOptions, setShowMobileOptions] = useState(false);

  const hasActiveFilter =
    filters.search.trim() !== '' ||
    filters.category !== 'all' ||
    filters.importance !== 'all' ||
    filters.color !== 'all';

  const mobileHiddenFilterCount =
    (filters.category !== 'all' ? 1 : 0) +
    (filters.color !== 'all' ? 1 : 0) +
    (groupMode === 'color' && activeView === 'timeline' ? 1 : 0);

  const hasAssignedColors = colorCounts.assignedTotal > 0;
  const onlyImportant = filters.importance === 3;

  return (
    <section
      aria-label="検索と絞り込み"
      className="bg-[#F4F0E8]/60 border-b border-[#E6E0D6]"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 space-y-2.5">
        {/* Row 1: Dataset Title + Desktop Quick Controls */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-serif font-semibold text-[#1C1917] truncate">
              {datasetTitle}
            </h1>
            <span className="text-xs font-mono tabular-nums text-[#78716C] whitespace-nowrap shrink-0">
              {filteredCount === totalCount
                ? `${totalCount}件`
                : `${filteredCount} / ${totalCount}件`}
            </span>
          </div>

          {/* Mobile inline reset shortcut when filtered */}
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              className="md:hidden inline-flex items-center gap-1 min-h-[34px] px-2 text-xs font-medium text-[#9A3412] whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              リセット
            </button>
          )}

          {/* Desktop Quick Study Controls */}
          <div className="hidden md:flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onChangeFilters({
                  ...filters,
                  importance: onlyImportant ? 'all' : 3,
                })
              }
              aria-pressed={onlyImportant}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap transition-colors ${
                onlyImportant
                  ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                  : 'bg-white text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
              }`}
            >
              <Star className="w-3 h-3" aria-hidden="true" />
              重要事項のみ
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeFilters({
                  ...filters,
                  sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
                })
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-md text-[#1C1917] whitespace-nowrap transition-colors"
            >
              <ArrowDownUp className="w-3 h-3 text-[#57534E]" aria-hidden="true" />
              {filters.sortOrder === 'asc' ? '古い順' : '新しい順'}
            </button>

            {activeView === 'timeline' && (
              <div
                role="group"
                aria-label="年表のグループ分け"
                className="inline-flex items-center p-0.5 bg-[#E6E0D6]/70 rounded-md"
              >
                <button
                  type="button"
                  onClick={() => onChangeGroupMode('era')}
                  aria-pressed={groupMode === 'era'}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    groupMode === 'era'
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  時代順
                </button>
                <button
                  type="button"
                  onClick={() => onChangeGroupMode('color')}
                  aria-pressed={groupMode === 'color'}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    groupMode === 'color'
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  色別
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenColorEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border bg-white text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917] hover:border-[#1C1917] whitespace-nowrap transition-colors"
            >
              <Palette className="w-3 h-3" aria-hidden="true" />
              色分け編集
            </button>
          </div>
        </div>

        {/* Row 2: Search + Mobile Quick Actions (★重要 + 絞込) / Desktop Category Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="timeline-search" className="sr-only">
              出来事・人物・場所・原因を検索
            </label>
            <input
              id="timeline-search"
              type="text"
              value={filters.search}
              onChange={(e) =>
                onChangeFilters({ ...filters, search: e.target.value })
              }
              placeholder="出来事・人物・場所を検索..."
              className="w-full h-11 md:h-9 pl-9 md:pl-8 pr-9 md:pr-8 text-base md:text-sm bg-white border border-[#D6CEBE] rounded-xl md:rounded-md text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#9A3412]"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="検索語をクリア"
                onClick={() => onChangeFilters({ ...filters, search: '' })}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] md:min-h-0 md:min-w-0 flex items-center justify-center p-1 text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile 1-tap Important filter + Collapsible Options Toggle */}
          <button
            type="button"
            onClick={() =>
              onChangeFilters({
                ...filters,
                importance: onlyImportant ? 'all' : 3,
              })
            }
            aria-pressed={onlyImportant}
            aria-label="重要事項のみ表示"
            className={`md:hidden inline-flex items-center justify-center gap-1 min-h-[44px] px-3 text-xs font-medium rounded-xl border whitespace-nowrap shrink-0 transition-colors ${
              onlyImportant
                ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                : 'bg-white text-[#57534E] border-[#D6CEBE]'
            }`}
          >
            <Star
              className={`w-3.5 h-3.5 ${onlyImportant ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            <span>重要</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileOptions((prev) => !prev)}
            aria-expanded={showMobileOptions}
            className={`md:hidden inline-flex items-center justify-center gap-1 min-h-[44px] px-3 text-xs font-medium rounded-xl border whitespace-nowrap shrink-0 transition-colors ${
              showMobileOptions || mobileHiddenFilterCount > 0
                ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                : 'bg-white text-[#1C1917] border-[#D6CEBE]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              絞込{mobileHiddenFilterCount > 0 ? `(${mobileHiddenFilterCount})` : ''}
            </span>
          </button>

          {/* Desktop Category Dropdown + Reset */}
          <label htmlFor="category-filter" className="sr-only">
            分野で絞り込み
          </label>
          <select
            id="category-filter"
            value={filters.category}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                category: e.target.value as EventCategory | 'all',
              })
            }
            className="hidden md:block h-9 px-3 text-xs sm:text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] shrink-0 focus:outline-none focus:border-[#9A3412]"
          >
            <option value="all">分野: すべて</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="絞り込み条件をリセット"
              className="hidden md:inline-flex items-center gap-1 h-9 px-2.5 text-xs font-medium text-[#9A3412] hover:bg-[#9A3412]/10 rounded-md whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>リセット</span>
            </button>
          )}
        </div>

        {/* Mobile Collapsible Options Drawer */}
        {showMobileOptions && (
          <div className="md:hidden pt-2.5 border-t border-[#E6E0D6] space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="分野で絞り込み"
                value={filters.category}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    category: e.target.value as EventCategory | 'all',
                  })
                }
                className="col-span-2 w-full h-11 px-3 text-base bg-white border border-[#D6CEBE] rounded-xl text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
              >
                <option value="all">分野: すべて</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    分野: {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  onChangeFilters({
                    ...filters,
                    sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc',
                  })
                }
                className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 text-xs font-medium bg-white border border-[#D6CEBE] rounded-xl text-[#1C1917] whitespace-nowrap"
              >
                <ArrowDownUp className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                {filters.sortOrder === 'asc' ? '古い順' : '新しい順'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMobileOptions(false);
                  onOpenColorEdit();
                }}
                className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3 text-xs font-medium bg-white border border-[#D6CEBE] rounded-xl text-[#1C1917] whitespace-nowrap"
              >
                <Palette className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
                色分け編集
              </button>

              {activeView === 'timeline' && (
                <div
                  role="group"
                  aria-label="年表のグループ分け"
                  className="col-span-2 grid grid-cols-2 gap-1 p-1 bg-[#E6E0D6]/70 rounded-xl"
                >
                  <button
                    type="button"
                    onClick={() => onChangeGroupMode('era')}
                    aria-pressed={groupMode === 'era'}
                    className={`min-h-[38px] text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      groupMode === 'era'
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#57534E]'
                    }`}
                  >
                    時代順で表示
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeGroupMode('color')}
                    aria-pressed={groupMode === 'color'}
                    className={`min-h-[38px] text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      groupMode === 'color'
                        ? 'bg-white text-[#1C1917] shadow-xs'
                        : 'text-[#57534E]'
                    }`}
                  >
                    色別で表示
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Row 3: Read-only Color Filter Strip (always shown on desktop when assigned; on mobile shown inside drawer or when a color filter is active) */}
        {hasAssignedColors && (
          <div
            role="group"
            aria-label="色による絞り込み"
            className={`${
              showMobileOptions || filters.color !== 'all' ? 'flex' : 'hidden md:flex'
            } items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap pb-0.5`}
          >
            <span className="inline-flex items-center gap-1 text-xs text-[#78716C] mr-0.5 shrink-0">
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              色:
            </span>
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, color: 'all' })}
              aria-pressed={filters.color === 'all'}
              className={`inline-flex items-center gap-1.5 min-h-[36px] md:min-h-0 px-3 md:px-2.5 py-1 text-xs font-medium rounded-lg md:rounded border whitespace-nowrap shrink-0 transition-colors ${
                filters.color === 'all'
                  ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                  : 'bg-white text-[#57534E] border-[#E6E0D6] hover:text-[#1C1917]'
              }`}
            >
              <span>すべて</span>
              <span className="font-mono tabular-nums opacity-75">
                {colorCounts.total}
              </span>
            </button>

            {COLOR_PALETTE.map((def) => {
              const count = colorCounts.byColor[def.id] ?? 0;
              const active = filters.color === def.id;
              if (count === 0 && !active) return null;
              const label = colorLabels[def.id] || def.defaultLabel;
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() =>
                    onChangeFilters({
                      ...filters,
                      color: active ? 'all' : def.id,
                    })
                  }
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] md:min-h-0 px-3 md:px-2.5 py-1 text-xs rounded-lg md:rounded border whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-[#1C1917] border-[#1C1917] font-semibold shadow-xs'
                      : 'bg-white text-[#44403C] border-[#E6E0D6] hover:border-[#A8A29E]'
                  }`}
                  style={
                    active
                      ? { backgroundColor: def.surfaceHex }
                      : undefined
                  }
                >
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: def.swatchHex }}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                  <span className="font-mono tabular-nums text-[11px] text-[#78716C]">
                    {count}
                  </span>
                </button>
              );
            })}

            {(colorCounts.none > 0 || filters.color === 'none') && (
              <button
                type="button"
                onClick={() =>
                  onChangeFilters({
                    ...filters,
                    color: filters.color === 'none' ? 'all' : 'none',
                  })
                }
                aria-pressed={filters.color === 'none'}
                className={`inline-flex items-center gap-1.5 min-h-[36px] md:min-h-0 px-3 md:px-2.5 py-1 text-xs rounded-lg md:rounded border whitespace-nowrap shrink-0 transition-colors ${
                  filters.color === 'none'
                    ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917] font-medium'
                    : 'bg-white text-[#57534E] border-[#E6E0D6] hover:text-[#1C1917]'
                }`}
              >
                <span>色なし</span>
                <span className="font-mono tabular-nums text-[11px] opacity-75">
                  {colorCounts.none}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
