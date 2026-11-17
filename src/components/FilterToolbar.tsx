import { useState } from 'react';
import {
  ArrowDownUp,
  Palette,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  COLOR_PALETTE,
  type AssignedColorId,
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
  onUpdateColorLabel: (colorId: AssignedColorId, label: string) => void;
  onApplyLabelPreset: (preset: 'category' | 'study' | 'importance') => void;
  onAutoAssignByCategory: () => void;
  onAutoAssignByImportance: () => void;
  onClearAllColors: () => void;
  onChangeFilters: (next: TimelineFilters) => void;
  onResetFilters: () => void;
  onExportJson: () => void;
  onOpenImport: () => void;
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
  onUpdateColorLabel,
  onApplyLabelPreset,
  onAutoAssignByCategory,
  onAutoAssignByImportance,
  onClearAllColors,
  onChangeFilters,
  onResetFilters,
}: FilterToolbarProps) {
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);

  const hasActiveFilter =
    filters.search.trim() !== '' ||
    filters.category !== 'all' ||
    filters.importance !== 'all' ||
    filters.color !== 'all';

  const hasAssignedColors = colorCounts.assignedTotal > 0;
  const onlyImportant = filters.importance === 3;

  return (
    <section
      aria-label="検索と絞り込み"
      className="bg-[#F4F0E8]/60 border-b border-[#E6E0D6]"
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-2.5">
        {/* Row 1: Dataset Title + Quick Study Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-base sm:text-lg font-serif font-semibold text-[#1C1917] truncate">
              {datasetTitle}
            </h1>
            <span className="text-xs font-mono tabular-nums text-[#78716C] whitespace-nowrap shrink-0">
              {filteredCount === totalCount
                ? `${totalCount}件`
                : `${filteredCount} / ${totalCount}件`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
              onClick={() => setIsColorSettingsOpen((v) => !v)}
              aria-expanded={isColorSettingsOpen}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap transition-colors ${
                isColorSettingsOpen
                  ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                  : 'bg-white text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
              }`}
            >
              <Palette className="w-3 h-3" aria-hidden="true" />
              色の設定
            </button>
          </div>
        </div>

        {/* Row 2: Search + Category Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
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
              placeholder="出来事・人物・場所・原因を検索..."
              className="w-full h-9 pl-8 pr-8 text-xs sm:text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] placeholder:text-[#78716C] focus:outline-none focus:border-[#9A3412]"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="検索語をクリア"
                onClick={() => onChangeFilters({ ...filters, search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

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
            className="h-9 px-3 text-xs sm:text-sm bg-white border border-[#D6CEBE] rounded-md text-[#1C1917] shrink-0 focus:outline-none focus:border-[#9A3412]"
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
              className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-medium text-[#9A3412] hover:bg-[#9A3412]/10 rounded-md whitespace-nowrap shrink-0 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">リセット</span>
            </button>
          )}
        </div>

        {/* Row 3: Honest, Context-Aware Color Filter / Quick Setup Strip */}
        {hasAssignedColors ? (
          <div
            role="group"
            aria-label="色による絞り込み"
            className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-0.5"
          >
            <span className="inline-flex items-center gap-1 text-xs text-[#78716C] mr-0.5 shrink-0">
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              色:
            </span>
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, color: 'all' })}
              aria-pressed={filters.color === 'all'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
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
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border whitespace-nowrap shrink-0 transition-colors ${
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
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border whitespace-nowrap shrink-0 transition-colors ${
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
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
            <span className="inline-flex items-center gap-1 text-[#78716C] shrink-0">
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              色分け: 未設定
            </span>
            <button
              type="button"
              onClick={onAutoAssignByCategory}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3 text-[#9A3412]" aria-hidden="true" />
              分野で一括色分け
            </button>
            <button
              type="button"
              onClick={onAutoAssignByImportance}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded transition-colors whitespace-nowrap"
            >
              重要度で一括色分け
            </button>
            <span className="text-[11px] text-[#78716C]">
              （各出来事の詳細欄から1クリックで個別に色付けもできます）
            </span>
          </div>
        )}

        {/* Collapsible Color Settings & Label Editor Drawer */}
        {isColorSettingsOpen && (
          <div className="pt-3 mt-1 border-t border-[#E6E0D6] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#57534E]">
                  自動色分け:
                </span>
                <button
                  type="button"
                  onClick={onAutoAssignByCategory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-md transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
                  分野で自動色分け
                </button>
                <button
                  type="button"
                  onClick={onAutoAssignByImportance}
                  className="px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded-md transition-colors whitespace-nowrap"
                >
                  重要度で自動色分け
                </button>
                {hasAssignedColors && (
                  <button
                    type="button"
                    onClick={onClearAllColors}
                    className="px-3 py-1.5 text-xs font-medium text-[#78716C] hover:text-[#991B1B] bg-white border border-[#E6E0D6] rounded-md transition-colors whitespace-nowrap"
                  >
                    すべての色を解除
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#78716C]">ラベル用途:</span>
                <button
                  type="button"
                  onClick={() => onApplyLabelPreset('category')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#57534E] hover:text-[#1C1917] bg-white border border-[#E6E0D6] rounded transition-colors whitespace-nowrap"
                >
                  分野用
                </button>
                <button
                  type="button"
                  onClick={() => onApplyLabelPreset('study')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#57534E] hover:text-[#1C1917] bg-white border border-[#E6E0D6] rounded transition-colors whitespace-nowrap"
                >
                  暗記・復習用
                </button>
                <button
                  type="button"
                  onClick={() => onApplyLabelPreset('importance')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#57534E] hover:text-[#1C1917] bg-white border border-[#E6E0D6] rounded transition-colors whitespace-nowrap"
                >
                  重要度用
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-medium text-[#78716C] mb-1.5">
                6色の名前・意味を自由に編集（各出来事の詳細パネルや絞り込みに反映されます）
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {COLOR_PALETTE.map((def) => (
                  <label
                    key={def.id}
                    className="flex items-center gap-2 bg-white border border-[#E6E0D6] rounded px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className="w-3 h-3 rounded-[2px] shrink-0"
                      style={{ backgroundColor: def.swatchHex }}
                      aria-hidden="true"
                    />
                    <span className="text-[11px] text-[#78716C] shrink-0 w-7">
                      {def.colorName}
                    </span>
                    <input
                      type="text"
                      value={colorLabels[def.id] || ''}
                      onChange={(e) =>
                        onUpdateColorLabel(def.id, e.target.value)
                      }
                      placeholder={def.defaultLabel}
                      className="w-full bg-transparent text-[#1C1917] focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
