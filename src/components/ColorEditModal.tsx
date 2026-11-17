import { useEffect, useMemo, useState } from 'react';
import { Palette, Search, Sparkles, X } from 'lucide-react';
import {
  COLOR_PALETTE,
  type AssignedColorId,
  type ColorId,
  type ColorLabelsMap,
  type EventColorsMap,
  type HistoricalEvent,
} from '../types/timeline';
import { sortEventsChronologically } from '../utils/timelineParser';

interface ColorEditModalProps {
  isOpen: boolean;
  events: HistoricalEvent[];
  selectedEvent: HistoricalEvent | null;
  eventColors: EventColorsMap;
  colorLabels: ColorLabelsMap;
  onAssignColor: (eventId: string, colorId: ColorId) => void;
  onUpdateColorLabel: (colorId: AssignedColorId, label: string) => void;
  onApplyLabelPreset: (preset: 'category' | 'study' | 'importance') => void;
  onAutoAssignByCategory: () => void;
  onAutoAssignByImportance: () => void;
  onClearAllColors: () => void;
  onClose: () => void;
}

export function ColorEditModal({
  isOpen,
  events,
  selectedEvent,
  eventColors,
  colorLabels,
  onAssignColor,
  onUpdateColorLabel,
  onApplyLabelPreset,
  onAutoAssignByCategory,
  onAutoAssignByImportance,
  onClearAllColors,
  onClose,
}: ColorEditModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const sortedEvents = useMemo(
    () => sortEventsChronologically(events, 'asc'),
    [events]
  );

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedEvents;
    return sortedEvents.filter(
      (ev) =>
        ev.title.toLowerCase().includes(q) ||
        ev.date.toLowerCase().includes(q) ||
        ev.places.some((p) => p.toLowerCase().includes(q))
    );
  }, [sortedEvents, searchQuery]);

  if (!isOpen) return null;

  const hasAssignedColors = Object.keys(eventColors).length > 0;

  const renderColorButtons = (ev: HistoricalEvent) => {
    const currentColor: ColorId =
      (eventColors[ev.id] as ColorId | undefined) ?? 'none';

    return (
      <div
        role="group"
        aria-label={`${ev.title} の色分け`}
        className="flex flex-wrap items-center gap-1.5"
      >
        {COLOR_PALETTE.map((def) => {
          const active = currentColor === def.id;
          const label = colorLabels[def.id] || def.defaultLabel;
          return (
            <button
              key={def.id}
              type="button"
              onClick={() => onAssignColor(ev.id, active ? 'none' : def.id)}
              aria-pressed={active}
              title={`${def.colorName}：${label}`}
              className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
                active
                  ? 'bg-white text-[#1C1917] border-[#1C1917] font-semibold ring-1 ring-[#1C1917]'
                  : 'bg-white text-[#44403C] border-[#D6CEBE] hover:border-[#1C1917]'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                style={{ backgroundColor: def.swatchHex }}
                aria-hidden="true"
              />
              <span>{label}</span>
            </button>
          );
        })}
        {currentColor !== 'none' && (
          <button
            type="button"
            onClick={() => onAssignColor(ev.id, 'none')}
            className="px-2 py-1 text-xs text-[#78716C] hover:text-[#1C1917] underline underline-offset-2"
          >
            解除
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/50 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="color-edit-modal-title"
        data-testid="color-edit-modal"
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-[#E6E0D6] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Palette className="w-5 h-5 text-[#9A3412] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2
                id="color-edit-modal-title"
                className="text-lg font-serif font-bold text-[#1C1917] truncate"
              >
                色分けの編集
              </h2>
              <p className="text-xs text-[#78716C]">
                普段は閲覧専用としてすっきり表示し、色分けやラベルの設定はここから編集できます。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="編集画面を閉じる"
            className="p-2 text-[#57534E] hover:text-[#1C1917] rounded-md shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Edit Body */}
        <div className="flex-1 overflow-y-auto archival-scroll p-5 space-y-6">
          {/* 1. Selected Event Quick Coloring */}
          {selectedEvent && (
            <section
              aria-label="選択中の出来事の色分け"
              className="bg-white border border-[#D6CEBE] rounded-lg p-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-xs font-semibold text-[#9A3412]">
                  現在選択中の出来事
                </div>
                <div className="text-xs font-mono tabular-nums text-[#78716C]">
                  {selectedEvent.date}
                </div>
              </div>
              <div className="font-serif font-bold text-base text-[#1C1917]">
                {selectedEvent.title}
              </div>
              {renderColorButtons(selectedEvent)}
            </section>
          )}

          {/* 2. Batch Auto-Coloring */}
          <section
            aria-label="一括色分け"
            className="bg-white border border-[#E6E0D6] rounded-lg p-4 space-y-3"
          >
            <h3 className="text-sm font-serif font-bold text-[#1C1917]">
              一括で色分けする
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAutoAssignByCategory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md transition-colors whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
                分野で自動色分け
              </button>
              <button
                type="button"
                onClick={onAutoAssignByImportance}
                className="px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-md transition-colors whitespace-nowrap"
              >
                重要度で自動色分け
              </button>
              {hasAssignedColors && (
                <button
                  type="button"
                  onClick={onClearAllColors}
                  className="px-3 py-1.5 text-xs font-medium text-[#991B1B] bg-white border border-[#FECACA] hover:bg-[#FEF2F2] rounded-md transition-colors whitespace-nowrap"
                >
                  すべての色を解除
                </button>
              )}
            </div>
          </section>

          {/* 3. Edit 6 Color Labels */}
          <section
            aria-label="色の名前・意味の編集"
            className="bg-white border border-[#E6E0D6] rounded-lg p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-serif font-bold text-[#1C1917]">
                6色の名前・意味を編集
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#78716C]">プリセット:</span>
                <button
                  type="button"
                  onClick={() => onApplyLabelPreset('category')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#57534E] hover:text-[#1C1917] bg-[#FBF9F5] border border-[#E6E0D6] rounded transition-colors"
                >
                  分野用
                </button>
                <button
                  type="button"
                  onClick={() => onApplyLabelPreset('study')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#57534E] hover:text-[#1C1917] bg-[#FBF9F5] border border-[#E6E0D6] rounded transition-colors"
                >
                  暗記・復習用
                </button>
                <button
                  type="button"
                  onClick={() => onApplyLabelPreset('importance')}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#57534E] hover:text-[#1C1917] bg-[#FBF9F5] border border-[#E6E0D6] rounded transition-colors"
                >
                  重要度用
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {COLOR_PALETTE.map((def) => (
                <label
                  key={def.id}
                  className="flex items-center gap-2 bg-[#FBF9F5] border border-[#E6E0D6] rounded px-2.5 py-1.5 text-xs"
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
          </section>

          {/* 4. Individual Event Color Assignments */}
          <section
            aria-label="出来事ごとの個別色分け"
            className="bg-white border border-[#E6E0D6] rounded-lg p-4 space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-serif font-bold text-[#1C1917]">
                出来事ごとの個別色分け（{events.length}件）
              </h3>
              <div className="relative w-full sm:w-64">
                <Search
                  className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="出来事・年代で絞り込む..."
                  aria-label="色分け対象の出来事を検索"
                  className="w-full h-8 pl-8 pr-3 text-xs bg-[#FBF9F5] border border-[#D6CEBE] rounded text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                />
              </div>
            </div>

            <div className="divide-y divide-[#E6E0D6] border border-[#E6E0D6] rounded-md max-h-72 overflow-y-auto archival-scroll">
              {filteredEvents.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#78716C]">
                  該当する出来事が見つかりませんでした。
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const assignedId = eventColors[ev.id];
                  const colorDef = assignedId
                    ? COLOR_PALETTE.find((c) => c.id === assignedId)
                    : undefined;
                  return (
                    <div
                      key={ev.id}
                      className="p-3 space-y-2 transition-colors"
                      style={
                        colorDef
                          ? { backgroundColor: colorDef.surfaceHex }
                          : undefined
                      }
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="text-xs font-mono tabular-nums text-[#78716C]">
                          {ev.date}
                        </span>
                        <span className="text-sm font-serif font-semibold text-[#1C1917]">
                          {ev.title}
                        </span>
                      </div>
                      {renderColorButtons(ev)}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-[#E6E0D6] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors"
          >
            完了して閲覧に戻る
          </button>
        </div>
      </div>
    </div>
  );
}
