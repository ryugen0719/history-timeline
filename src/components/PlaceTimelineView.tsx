import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Columns3,
  GitFork,
  Layers,
  MapPin,
  Star,
  TableProperties,
} from 'lucide-react';
import {
  COLOR_PALETTE,
  type ColorLabelsMap,
  type EventColorsMap,
  type HistoricalEvent,
  type PersonProfilesMap,
} from '../types/timeline';
import {
  buildRegionMatrixRows,
  computeRegionRelationships,
  findRelatedEventIdsForHighlight,
  formatSubDateInYearRow,
  groupEventsByRegion,
  type MatrixSingleItem,
  type PlaceGranularity,
} from '../utils/regionGrouping';
import { groupEventsByPlace } from '../utils/timelineParser';
import { PersonAvatar } from './PersonAvatar';

interface PlaceTimelineViewProps {
  events: HistoricalEvent[];
  allEvents: HistoricalEvent[];
  selectedEventId: string | null;
  eventColors: EventColorsMap;
  colorLabels: ColorLabelsMap;
  personProfiles: PersonProfilesMap;
  onSelectEvent: (eventId: string) => void;
  onClearSelection?: () => void;
  onResetFilters: () => void;
}

type PlaceDisplayMode = 'matrix' | 'relations' | 'lanes';

function shortenRegionTitle(region: string): string {
  const idx = region.indexOf('（');
  return idx > 0 ? region.slice(0, idx) : region;
}

export function PlaceTimelineView({
  events,
  allEvents,
  selectedEventId,
  eventColors,
  colorLabels,
  personProfiles,
  onSelectEvent,
  onClearSelection,
  onResetFilters,
}: PlaceTimelineViewProps) {
  const [displayMode, setDisplayMode] = useState<PlaceDisplayMode>('matrix');
  const [granularity, setGranularity] = useState<PlaceGranularity>('macro');
  const [selectedRegionsFilter, setSelectedRegionsFilter] = useState<string[]>(
    []
  );
  const [focusedRelationId, setFocusedRelationId] = useState<string | null>(
    null
  );
  const [focusedNodeRegion, setFocusedNodeRegion] = useState<string | null>(
    null
  );

  const rawPlaceCount = useMemo(
    () => groupEventsByPlace(events).length,
    [events]
  );

  const allRegionGroups = useMemo(
    () => groupEventsByRegion(events, granularity),
    [events, granularity]
  );

  const visibleRegionGroups = useMemo(() => {
    if (selectedRegionsFilter.length === 0) return allRegionGroups;
    const set = new Set(selectedRegionsFilter);
    const matched = allRegionGroups.filter((g) => set.has(g.region));
    return matched.length > 0 ? matched : allRegionGroups;
  }, [allRegionGroups, selectedRegionsFilter]);

  const allRegionSet = useMemo(
    () => new Set(allRegionGroups.map((g) => g.region)),
    [allRegionGroups]
  );

  const visibleRegions = useMemo(
    () => visibleRegionGroups.map((g) => g.region),
    [visibleRegionGroups]
  );

  const selectedEvent = useMemo(
    () =>
      events.find((e) => e.id === selectedEventId) ??
      allEvents.find((e) => e.id === selectedEventId) ??
      null,
    [events, allEvents, selectedEventId]
  );

  const relatedEventIds = useMemo(
    () => findRelatedEventIdsForHighlight(selectedEvent, allEvents),
    [selectedEvent, allEvents]
  );

  const allRegionLinks = useMemo(
    () => computeRegionRelationships(events, allRegionGroups, granularity),
    [events, allRegionGroups, granularity]
  );

  const regionLinks = useMemo(
    () =>
      computeRegionRelationships(events, visibleRegionGroups, granularity),
    [events, visibleRegionGroups, granularity]
  );

  const matrixRows = useMemo(
    () =>
      buildRegionMatrixRows(
        events,
        visibleRegions,
        granularity,
        allRegionSet
      ),
    [events, visibleRegions, granularity, allRegionSet]
  );

  const quickComparePairs = useMemo(() => {
    if (allRegionGroups.length < 3) return [];
    return allRegionLinks.slice(0, 2);
  }, [allRegionGroups.length, allRegionLinks]);

  // Neighbor summary map per region for quick display in lanes
  const regionNeighborMap = useMemo(() => {
    const map = new Map<string, Array<{ target: string; count: number; linkId: string }>>();
    for (const link of regionLinks) {
      const listA = map.get(link.regionA) ?? [];
      listA.push({
        target: link.regionB,
        count: link.totalStrength,
        linkId: link.id,
      });
      map.set(link.regionA, listA);

      const listB = map.get(link.regionB) ?? [];
      listB.push({
        target: link.regionA,
        count: link.totalStrength,
        linkId: link.id,
      });
      map.set(link.regionB, listB);
    }
    return map;
  }, [regionLinks]);

  const toggleRegionSelection = (region: string) => {
    setSelectedRegionsFilter((prev) =>
      prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region]
    );
  };

  const handleChangeGranularity = (next: PlaceGranularity) => {
    setGranularity(next);
    setSelectedRegionsFilter([]);
    setFocusedRelationId(null);
    setFocusedNodeRegion(null);
  };

  if (events.length === 0) {
    return (
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-12 text-center">
        <h2 className="text-lg font-serif font-semibold text-[#1C1917] mb-2">
          表示できる地域別データがありません
        </h2>
        <p className="text-sm text-[#57534E] mb-5">
          絞り込み条件をリセットすると地域ごとの年表を表示できます。
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="px-4 py-2 text-sm font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-[#9A3412] rounded-md transition-colors"
        >
          絞り込みをリセット
        </button>
      </div>
    );
  }

  // SVG Layout for "地域のつながり"
  const diagramNodes = visibleRegionGroups.filter(
    (g) => g.region !== '場所不明'
  );
  const svgWidth = 680;
  const svgHeight = 315;
  const nodePositions = new Map<string, { x: number; y: number }>();
  if (diagramNodes.length === 1) {
    nodePositions.set(diagramNodes[0].region, { x: 340, y: 155 });
  } else if (diagramNodes.length === 2) {
    nodePositions.set(diagramNodes[0].region, { x: 185, y: 155 });
    nodePositions.set(diagramNodes[1].region, { x: 495, y: 155 });
  } else if (diagramNodes.length > 2) {
    const cx = 340;
    const cy = 158;
    const rx = 232;
    const ry = 108;
    diagramNodes.forEach((node, idx) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * idx) / diagramNodes.length;
      nodePositions.set(node.region, {
        x: Math.round(cx + rx * Math.cos(angle)),
        y: Math.round(cy + ry * Math.sin(angle)),
      });
    });
  }

  const displayedLinks = regionLinks.filter((link) => {
    if (focusedRelationId) return link.id === focusedRelationId;
    if (focusedNodeRegion) {
      return (
        link.regionA === focusedNodeRegion || link.regionB === focusedNodeRegion
      );
    }
    return true;
  });

  return (
    <div className="space-y-5" data-testid="place-timeline-view">
      {/* Header & Controls Card */}
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <div className="inline-flex items-center gap-2 text-sm font-medium text-[#1C1917]">
              <MapPin className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
              <span>
                {granularity === 'macro'
                  ? `地域ごとの年表（${allRegionGroups.length}エリア）`
                  : `場所ごとの年表（${allRegionGroups.length}地名）`}
              </span>
            </div>
            {granularity === 'macro' &&
              rawPlaceCount > allRegionGroups.length && (
                <span className="text-xs text-[#78716C] tabular-nums">
                  {rawPlaceCount}地名を広域エリアに整理済み
                </span>
              )}
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            {/* Granularity Toggle */}
            <div
              role="group"
              aria-label="地域のまとめ方"
              className="grid grid-cols-2 sm:inline-flex items-center p-0.5 bg-[#F4F0E8] rounded-lg sm:rounded-md"
            >
              <button
                type="button"
                onClick={() => handleChangeGranularity('macro')}
                aria-pressed={granularity === 'macro'}
                className={`inline-flex items-center justify-center gap-1 min-h-[38px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  granularity === 'macro'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <Layers className="w-3 h-3" aria-hidden="true" />
                広域エリア
              </button>
              <button
                type="button"
                onClick={() => handleChangeGranularity('exact')}
                aria-pressed={granularity === 'exact'}
                className={`inline-flex items-center justify-center min-h-[38px] sm:min-h-0 px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  granularity === 'exact'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                詳細地名
              </button>
            </div>

            {/* 3 Clear Display Modes */}
            <div
              role="group"
              aria-label="地域別表示方式"
              className="grid grid-cols-3 sm:inline-flex items-center p-0.5 bg-[#F4F0E8] rounded-lg sm:rounded-md"
            >
              <button
                type="button"
                onClick={() => setDisplayMode('matrix')}
                aria-pressed={displayMode === 'matrix'}
                className={`inline-flex items-center justify-center gap-1 min-h-[38px] sm:min-h-0 px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  displayMode === 'matrix'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <TableProperties className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                対照年表
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('relations')}
                aria-pressed={displayMode === 'relations'}
                className={`inline-flex items-center justify-center gap-1 min-h-[38px] sm:min-h-0 px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  displayMode === 'relations'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <GitFork className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                つながり
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('lanes')}
                aria-pressed={displayMode === 'lanes'}
                className={`inline-flex items-center justify-center gap-1 min-h-[38px] sm:min-h-0 px-2 sm:px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                  displayMode === 'lanes'
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                地域一覧
              </button>
            </div>
          </div>
        </div>

        {/* Region Filter Strip + Quick 2-Region Comparison */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedRegionsFilter([])}
              aria-pressed={selectedRegionsFilter.length === 0}
              className={`min-h-[36px] sm:min-h-0 px-3 sm:px-2.5 py-1 text-xs font-medium rounded-lg sm:rounded border whitespace-nowrap shrink-0 transition-colors ${
                selectedRegionsFilter.length === 0
                  ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                  : 'bg-[#FBF9F5] text-[#57534E] border-[#E6E0D6] hover:text-[#1C1917]'
              }`}
            >
              すべての地域
            </button>
            {allRegionGroups.map((group) => {
              const active = selectedRegionsFilter.includes(group.region);
              return (
                <button
                  key={group.region}
                  type="button"
                  onClick={() => toggleRegionSelection(group.region)}
                  aria-pressed={active}
                  title={
                    group.subPlaces.length > 0
                      ? `含まれる場所: ${group.subPlaces.join('・')}`
                      : undefined
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded border whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#9A3412] text-[#FBF9F5] border-[#9A3412]'
                      : 'bg-[#FBF9F5] text-[#57534E] border-[#E6E0D6] hover:text-[#1C1917]'
                  }`}
                >
                  {shortenRegionTitle(group.region)}{' '}
                  <span className="font-mono tabular-nums opacity-75">
                    ({group.events.length})
                  </span>
                </button>
              );
            })}
          </div>

          {quickComparePairs.length > 0 && displayMode !== 'relations' && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C] pt-1 border-t border-[#E6E0D6]/70">
              <span className="shrink-0">2地域を拡大比較:</span>
              {quickComparePairs.map((pair) => {
                const isPairActive =
                  selectedRegionsFilter.length === 2 &&
                  selectedRegionsFilter.includes(pair.regionA) &&
                  selectedRegionsFilter.includes(pair.regionB);
                return (
                  <button
                    key={pair.id}
                    type="button"
                    onClick={() =>
                      setSelectedRegionsFilter(
                        isPairActive ? [] : [pair.regionA, pair.regionB]
                      )
                    }
                    aria-pressed={isPairActive}
                    className={`px-2 py-0.5 rounded border text-xs transition-colors whitespace-nowrap shrink-0 ${
                      isPairActive
                        ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                        : 'bg-[#FBF9F5] text-[#44403C] border-[#E6E0D6] hover:border-[#9A3412] hover:text-[#9A3412]'
                    }`}
                  >
                    {shortenRegionTitle(pair.regionA)} ×{' '}
                    {shortenRegionTitle(pair.regionB)}
                  </button>
                );
              })}
              {selectedRegionsFilter.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedRegionsFilter([])}
                  className="text-xs text-[#9A3412] hover:underline ml-auto shrink-0"
                >
                  すべてに戻す
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode 1: Year-Synchronized Matrix with Non-Duplicated Cross-Region Spans */}
      {displayMode === 'matrix' && (() => {
        const colCount = visibleRegionGroups.length;
        const minTableWidth =
          colCount <= 2
            ? Math.max(560, 88 + colCount * 260)
            : 88 + colCount * 165;
        const regionColsTemplate = `repeat(${colCount}, minmax(0, 1fr))`;

        const renderMinimalMatrixCard = (
          ev: MatrixSingleItem['event'],
          hiddenRegions: string[],
          subDate: string | null,
          isSpanCard: boolean
        ) => {
          const isSelected = ev.id === selectedEventId;
          const isRelated = relatedEventIds.has(ev.id);
          const isUnrelated =
            Boolean(selectedEvent) && !isSelected && !isRelated;
          const colorId = eventColors[ev.id];
          const colorDef = colorId
            ? COLOR_PALETTE.find((c) => c.id === colorId)
            : undefined;

          const focusState = isSelected
            ? 'selected'
            : isRelated
              ? 'related'
              : isUnrelated
                ? 'unrelated'
                : 'none';

          return (
            <button
              type="button"
              data-focus-state={focusState}
              onClick={() => onSelectEvent(ev.id)}
              aria-pressed={isSelected}
              className={`w-full text-left px-3 py-2 rounded-md border transition-opacity duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C1917] ${
                isUnrelated
                  ? 'opacity-40 hover:opacity-95 focus-visible:opacity-95'
                  : 'opacity-100'
              } ${
                isSelected
                  ? 'border-[#1C1917] ring-2 ring-[#1C1917]/80 bg-[#FBF9F5] shadow-xs'
                  : isRelated
                    ? 'border-[#1D4ED8] ring-1 ring-[#1D4ED8]/50 bg-[#EEF4FF] shadow-xs'
                    : isSpanCard
                      ? 'border-[#D6CEBE] hover:border-[#9A3412] bg-[#FAF7F2]'
                      : 'border-[#E6E0D6] hover:border-[#9A3412] bg-white'
              }`}
              style={
                colorDef
                  ? {
                      backgroundColor: colorDef.surfaceHex,
                      borderColor: isSelected
                        ? '#1C1917'
                        : isRelated
                          ? '#1D4ED8'
                          : colorDef.borderHex,
                    }
                  : undefined
              }
            >
              {(Boolean(subDate) || ev.importance === 3 || isRelated || colorDef) && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#57534E] mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {subDate && (
                      <span className="font-mono tabular-nums">{subDate}</span>
                    )}
                    {ev.importance === 3 && (
                      <span
                        title="最重要"
                        aria-label="最重要"
                        className="inline-flex items-center text-[#9A3412]"
                      >
                        <Star
                          className="w-3 h-3 fill-[#9A3412]"
                          aria-hidden="true"
                        />
                      </span>
                    )}
                    {isRelated && !isSelected && (
                      <span className="font-semibold text-[#1D4ED8]">
                        {subDate || ev.importance === 3 ? '· ' : ''}関連
                      </span>
                    )}
                  </div>
                  {colorDef && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#44403C] shrink-0">
                      <span
                        className="w-2 h-2 rounded-[2px] shrink-0"
                        style={{ backgroundColor: colorDef.swatchHex }}
                        aria-hidden="true"
                      />
                      <span className="hidden xl:inline truncate max-w-[84px]">
                        {colorLabels[colorDef.id] || colorDef.defaultLabel}
                      </span>
                    </span>
                  )}
                </div>
              )}

              <div className="font-serif font-semibold text-sm text-[#1C1917] leading-snug">
                {ev.title}
              </div>

              {(ev.places.length > 0 || hiddenRegions.length > 0) && (
                <div className="mt-1 text-[11px] text-[#78716C] truncate">
                  {ev.places.join('・')}
                  {hiddenRegions.length > 0 && (
                    <span className="text-[#9A3412] ml-1.5">
                      · 他{hiddenRegions.length}地域連動
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        };

        return (
          <div className="space-y-2.5">
            <div className="space-y-1.5 text-xs text-[#57534E] px-0.5">
              <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  年ごとの行に地域を並べています。複数地域に関わる出来事は中心地域の四角形（長方形）から関連地域へ線でつないで表示しています。
                </span>
                <span className="inline-flex items-center gap-3 text-[11px] text-[#78716C]">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="w-3 h-2 rounded-[2px] border border-[#D6CEBE] bg-[#FAF7F2] inline-block"
                      aria-hidden="true"
                    />
                    出来事
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-flex items-center"
                      aria-hidden="true"
                    >
                      <span className="w-3 h-[2px] bg-[#9A3412]/70 inline-block" />
                      <span className="w-2 h-2 rounded-full bg-[#9A3412] inline-block -ml-0.5" />
                    </span>
                    関連地域へのつながり
                  </span>
                </span>
              </div>
              <div className="sm:hidden flex items-center justify-between text-[11px] text-[#78716C]">
                <span>← 横にスクロールして地域を比較 →</span>
              </div>
              <div className="min-h-[20px] flex flex-wrap items-center justify-between gap-2">
                {selectedEvent ? (
                  <>
                    {relatedEventIds.size > 0 ? (
                      <span className="font-medium text-[#1D4ED8]">
                        選択中「{selectedEvent.title}」の関連 {relatedEventIds.size}件を強調中
                      </span>
                    ) : (
                      <span className="text-[#78716C]">
                        選択中「{selectedEvent.title}」を強調中
                      </span>
                    )}
                    {onClearSelection && (
                      <button
                        type="button"
                        onClick={onClearSelection}
                        className="text-xs text-[#57534E] hover:text-[#1C1917] underline underline-offset-2 shrink-0"
                      >
                        選択を解除
                      </button>
                    )}
                  </>
                ) : (
                  <span className="hidden sm:inline text-[#78716C]">
                    出来事をタップすると関連する出来事を強調表示し、詳細を確認できます
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg overflow-hidden">
              <div className="overflow-x-auto archival-scroll">
                <div style={{ minWidth: `${minTableWidth}px` }}>
                  {/* Column Header Row */}
                  <div className="flex bg-[#F4F0E8] border-b border-[#E6E0D6] text-xs font-semibold text-[#57534E]">
                    <div className="w-[66px] sm:w-[88px] shrink-0 sticky left-0 z-20 bg-[#F4F0E8] px-2 sm:px-3 py-2.5 border-r border-[#E6E0D6] flex items-center">
                      年・時代
                    </div>
                    <div
                      className="flex-1 grid divide-x divide-[#E6E0D6]"
                      style={{ gridTemplateColumns: regionColsTemplate }}
                    >
                      {visibleRegionGroups.map((group) => (
                        <div
                          key={group.region}
                          className="px-3 py-2.5 min-w-0"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-serif text-sm font-bold text-[#1C1917] truncate">
                              {shortenRegionTitle(group.region)}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] font-normal text-[#78716C] shrink-0">
                              {group.events.length}
                            </span>
                          </div>
                          {granularity === 'macro' &&
                            group.subPlaces.length > 0 && (
                              <div className="text-[11px] font-normal text-[#78716C] truncate mt-0.5">
                                {group.subPlaces.slice(0, 4).join('・')}
                                {group.subPlaces.length > 4 ? ' ほか' : ''}
                              </div>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Year-by-Year Rows */}
                  <div className="divide-y divide-[#E6E0D6]">
                    {matrixRows.map((row) => (
                      <div key={row.key} className="flex items-stretch">
                        {/* Sticky Year Label */}
                        <div className="w-[66px] sm:w-[88px] shrink-0 sticky left-0 z-10 bg-[#FBF9F5] border-r border-[#E6E0D6] px-2 sm:px-3 py-3 flex items-start">
                          <span className="font-serif text-xs sm:text-sm font-bold text-[#1C1917] tabular-nums whitespace-nowrap">
                            {row.label}
                          </span>
                        </div>

                        {/* Region Columns + Connected Multi-Region Bands (Chronologically Ordered) */}
                        <div className="flex-1 relative min-w-0">
                          {/* Continuous Vertical Column Hairlines */}
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 grid divide-x divide-[#E6E0D6]/75"
                            style={{ gridTemplateColumns: regionColsTemplate }}
                          >
                            {visibleRegionGroups.map((g) => (
                              <div key={`bg-${row.key}-${g.region}`} />
                            ))}
                          </div>

                          <div className="relative z-[1] divide-y divide-[#E6E0D6]/60">
                            {row.bands.map((band, bandIdx) => {
                              if (band.type === 'single') {
                                return (
                                  <div
                                    key={`band-${row.key}-single-${bandIdx}`}
                                    className="grid"
                                    style={{ gridTemplateColumns: regionColsTemplate }}
                                  >
                                    {visibleRegionGroups.map((group) => {
                                      const items =
                                        band.singleByRegion.get(group.region) ?? [];
                                      return (
                                        <div
                                          key={`cell-${row.key}-${bandIdx}-${group.region}`}
                                          className="p-2 space-y-2 min-w-0"
                                        >
                                          {items.map((item) => (
                                            <div key={item.event.id}>
                                              {renderMinimalMatrixCard(
                                                item.event,
                                                item.hiddenRegions,
                                                formatSubDateInYearRow(
                                                  item.event,
                                                  row.label
                                                ),
                                                false
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              }

                              const spanItem = band.spanItem;
                              const activeColSet = new Set(
                                spanItem.regionIndices
                              );
                              const isSpanSelected =
                                spanItem.event.id === selectedEventId;
                              const isSpanRelated = relatedEventIds.has(
                                spanItem.event.id
                              );
                              const isSpanUnrelated =
                                Boolean(selectedEvent) &&
                                !isSpanSelected &&
                                !isSpanRelated;
                              const lineLeftPct =
                                ((spanItem.minCol + 0.5) / colCount) * 100;
                              const lineWidthPct =
                                ((spanItem.maxCol - spanItem.minCol) /
                                  colCount) *
                                100;

                              return (
                                <div
                                  key={`span-${row.key}-${spanItem.event.id}`}
                                  className="relative grid items-center"
                                  style={{ gridTemplateColumns: regionColsTemplate }}
                                >
                                  {/* Horizontal Connector Line between Anchor Rectangle and Related Region Nodes */}
                                  <div
                                    aria-hidden="true"
                                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-[1] transition-opacity duration-100 ${
                                      isSpanUnrelated
                                        ? 'opacity-35 h-[2px] bg-[#9A3412]/55'
                                        : isSpanSelected
                                          ? 'h-[2.5px] bg-[#1C1917]'
                                          : isSpanRelated
                                            ? 'h-[2.5px] bg-[#1D4ED8]'
                                            : 'h-[2px] bg-[#9A3412]/55'
                                    }`}
                                    style={{
                                      left: `${lineLeftPct}%`,
                                      width: `${lineWidthPct}%`,
                                    }}
                                  />

                                  {visibleRegionGroups.map((group, colIdx) => {
                                    if (colIdx === spanItem.anchorCol) {
                                      return (
                                        <div
                                          key={`span-anchor-${spanItem.event.id}-${colIdx}`}
                                          className="relative z-[2] p-2 min-w-0"
                                        >
                                          {renderMinimalMatrixCard(
                                            spanItem.event,
                                            spanItem.hiddenRegions,
                                            formatSubDateInYearRow(
                                              spanItem.event,
                                              row.label
                                            ),
                                            true
                                          )}
                                        </div>
                                      );
                                    }

                                    if (activeColSet.has(colIdx)) {
                                      const colPlaces =
                                        spanItem.placesByCol[colIdx] ?? [];
                                      const nodeLabel =
                                        colPlaces.length > 0
                                          ? colPlaces.join('・')
                                          : shortenRegionTitle(group.region);

                                      return (
                                        <div
                                          key={`span-node-${spanItem.event.id}-${colIdx}`}
                                          className="relative z-[2] py-2 px-1 flex items-center justify-center min-w-0"
                                        >
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onSelectEvent(spanItem.event.id)
                                            }
                                            aria-label={`${spanItem.event.title}（関連地域: ${nodeLabel}）`}
                                            title={`${spanItem.event.title} — ${nodeLabel}の詳細を開く`}
                                            className={`group flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded transition-opacity duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C1917] ${
                                              isSpanUnrelated
                                                ? 'opacity-40 hover:opacity-95 focus-visible:opacity-95'
                                                : 'opacity-100'
                                            }`}
                                          >
                                            {/* Equal-height top spacer keeps the dot centered on the horizontal connector line */}
                                            <span
                                              className="h-4"
                                              aria-hidden="true"
                                            />
                                            <span
                                              className={`w-3 h-3 rounded-full border-2 border-white shadow-xs transition-transform group-hover:scale-125 ${
                                                isSpanSelected
                                                  ? 'bg-[#1C1917] ring-2 ring-[#1C1917]/25'
                                                  : isSpanRelated
                                                    ? 'bg-[#1D4ED8]'
                                                    : 'bg-[#9A3412]'
                                              }`}
                                              aria-hidden="true"
                                            />
                                            <span className="h-4 flex items-center max-w-[140px]">
                                              <span className="px-1.5 py-0.5 rounded bg-white/95 border border-[#E6E0D6] text-[11px] font-medium text-[#44403C] group-hover:text-[#9A3412] group-hover:border-[#9A3412]/50 truncate leading-none">
                                                {nodeLabel}
                                              </span>
                                            </span>
                                          </button>
                                        </div>
                                      );
                                    }

                                    return (
                                      <div
                                        key={`span-pass-${spanItem.event.id}-${colIdx}`}
                                        className="min-w-0"
                                        aria-hidden="true"
                                      />
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Mode 2: Interactive Cross-Region Relationship Map & Flows */}
      {displayMode === 'relations' && (
        <div className="space-y-5">
          <div className="bg-white border border-[#E6E0D6] rounded-lg p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-serif font-bold text-[#1C1917]">
                  地域どうしのつながり図
                </h2>
                <p className="text-xs text-[#57534E] mt-0.5">
                  複数の地域にまたがる出来事や、ある地域から別の地域へ波及した出来事をもとに結びつきを表示しています。地域や線をクリックすると詳細を絞り込めます。
                </p>
              </div>
              {(focusedRelationId || focusedNodeRegion) && (
                <button
                  type="button"
                  onClick={() => {
                    setFocusedRelationId(null);
                    setFocusedNodeRegion(null);
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-[#9A3412] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded transition-colors whitespace-nowrap"
                >
                  すべてのつながりを表示
                </button>
              )}
            </div>

            {diagramNodes.length < 2 ? (
              <p className="text-sm text-[#57534E] py-6 text-center">
                2つ以上の地域エリアが含まれるデータで地域間のつながり図を表示できます。
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full max-w-[680px] mx-auto h-auto select-none"
                  role="img"
                  aria-label="地域間の関係図"
                >
                  {(() => {
                    const edgeLayouts = regionLinks
                      .map((link, idx) => {
                        const pA = nodePositions.get(link.regionA);
                        const pB = nodePositions.get(link.regionB);
                        if (!pA || !pB) return null;

                        const isHighlighted =
                          focusedRelationId === link.id ||
                          focusedNodeRegion === link.regionA ||
                          focusedNodeRegion === link.regionB ||
                          (!focusedRelationId && !focusedNodeRegion);

                        const midX = (pA.x + pB.x) / 2;
                        const midY = (pA.y + pB.y) / 2;
                        const dx = pB.x - pA.x;
                        const dy = pB.y - pA.y;
                        const curveOffset = (idx % 2 === 0 ? 1 : -1) * 18;
                        const norm = Math.hypot(dx, dy) || 1;
                        const ctrlX = midX - (dy / norm) * curveOffset;
                        const ctrlY = midY + (dx / norm) * curveOffset;

                        const distFromCenter = Math.hypot(
                          midX - svgWidth / 2,
                          midY - svgHeight / 2
                        );
                        const isCentralChord = distFromCenter < 70;
                        const t = isCentralChord
                          ? idx % 2 === 0
                            ? 0.28
                            : 0.72
                          : 0.5;
                        const oneMinusT = 1 - t;
                        const labelX =
                          oneMinusT * oneMinusT * pA.x +
                          2 * oneMinusT * t * ctrlX +
                          t * t * pB.x;
                        const labelY =
                          oneMinusT * oneMinusT * pA.y +
                          2 * oneMinusT * t * ctrlY +
                          t * t * pB.y;

                        const strokeWidth = Math.min(
                          4.5,
                          1.5 + link.totalStrength * 0.65
                        );

                        return {
                          link,
                          pA,
                          pB,
                          ctrlX,
                          ctrlY,
                          labelX,
                          labelY,
                          strokeWidth,
                          isHighlighted,
                        };
                      })
                      .filter((x): x is NonNullable<typeof x> => x !== null);

                    return (
                      <>
                        {/* Layer 1: Connection Paths */}
                        {edgeLayouts.map((item) => (
                          <path
                            key={`path-${item.link.id}`}
                            d={`M ${item.pA.x} ${item.pA.y} Q ${item.ctrlX} ${item.ctrlY} ${item.pB.x} ${item.pB.y}`}
                            fill="none"
                            className="cursor-pointer"
                            stroke={
                              focusedRelationId === item.link.id
                                ? '#9A3412'
                                : item.isHighlighted
                                  ? '#57534E'
                                  : '#E6E0D6'
                            }
                            strokeWidth={item.strokeWidth}
                            strokeOpacity={item.isHighlighted ? 0.8 : 0.45}
                            onClick={() => {
                              setFocusedNodeRegion(null);
                              setFocusedRelationId((prev) =>
                                prev === item.link.id ? null : item.link.id
                              );
                            }}
                          />
                        ))}

                        {/* Layer 2: Edge Count Badges */}
                        {edgeLayouts.map((item) => (
                          <g
                            key={`label-${item.link.id}`}
                            className="cursor-pointer"
                            onClick={() => {
                              setFocusedNodeRegion(null);
                              setFocusedRelationId((prev) =>
                                prev === item.link.id ? null : item.link.id
                              );
                            }}
                          >
                            <rect
                              x={item.labelX - 24}
                              y={item.labelY - 10}
                              width={48}
                              height={20}
                              rx={4}
                              fill={
                                focusedRelationId === item.link.id
                                  ? '#9A3412'
                                  : '#FBF9F5'
                              }
                              stroke={
                                focusedRelationId === item.link.id
                                  ? '#9A3412'
                                  : '#D6CEBE'
                              }
                            />
                            <text
                              x={item.labelX}
                              y={item.labelY + 4}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="600"
                              fill={
                                focusedRelationId === item.link.id
                                  ? '#FBF9F5'
                                  : '#1C1917'
                              }
                            >
                              {item.link.totalStrength}件連動
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}

                  {/* Layer 3: Region Nodes */}
                  {diagramNodes.map((node) => {
                    const pos = nodePositions.get(node.region);
                    if (!pos) return null;
                    const isFocused = focusedNodeRegion === node.region;
                    const shortName = shortenRegionTitle(node.region);
                    const boxWidth = Math.max(126, shortName.length * 14 + 28);
                    const boxHeight = 46;

                    return (
                      <g
                        key={node.region}
                        className="cursor-pointer"
                        onClick={() => {
                          setFocusedRelationId(null);
                          setFocusedNodeRegion((prev) =>
                            prev === node.region ? null : node.region
                          );
                        }}
                      >
                        <rect
                          x={pos.x - boxWidth / 2}
                          y={pos.y - boxHeight / 2}
                          width={boxWidth}
                          height={boxHeight}
                          rx={8}
                          fill={isFocused ? '#1C1917' : '#FFFFFF'}
                          stroke={isFocused ? '#1C1917' : '#9A3412'}
                          strokeWidth={isFocused ? 2 : 1.5}
                        />
                        <text
                          x={pos.x}
                          y={pos.y - 3}
                          textAnchor="middle"
                          fontSize="13"
                          fontWeight="700"
                          fill={isFocused ? '#FBF9F5' : '#1C1917'}
                        >
                          {shortName}
                        </text>
                        <text
                          x={pos.x}
                          y={pos.y + 14}
                          textAnchor="middle"
                          fontSize="11"
                          fill={isFocused ? '#D6CEBE' : '#57534E'}
                        >
                          {node.events.length}件の出来事
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Concrete Cross-Region Evidence Cards */}
          {displayedLinks.length === 0 ? (
            <div className="bg-white border border-[#E6E0D6] rounded-lg p-8 text-center text-sm text-[#57534E]">
              選択した条件では地域間の直接的な連動が見つかりませんでした。
            </div>
          ) : (
            <div className="space-y-4">
              {displayedLinks.map((link) => (
                <section
                  key={link.id}
                  aria-label={`${shortenRegionTitle(link.regionA)}と${shortenRegionTitle(link.regionB)}の関係`}
                  className="bg-white border border-[#E6E0D6] rounded-lg p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2 border-b border-[#E6E0D6]">
                    <h3 className="text-base font-serif font-bold text-[#1C1917]">
                      {shortenRegionTitle(link.regionA)} ↔{' '}
                      {shortenRegionTitle(link.regionB)}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-[#78716C]">
                      またがる出来事 {link.sharedEvents.length}件 · 地域間波及{' '}
                      {link.causalLinks.length}件
                    </span>
                  </div>

                  {link.sharedEvents.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#78716C] mb-1.5">
                        両地域にまたがって起きた出来事
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {link.sharedEvents.map((ev) => {
                          const isSelected = ev.id === selectedEventId;
                          return (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => onSelectEvent(ev.id)}
                              className={`text-left p-2.5 rounded border text-xs transition-colors ${
                                isSelected
                                  ? 'border-[#1C1917] ring-1 ring-[#1C1917] bg-[#FBF9F5]'
                                  : 'border-[#E6E0D6] hover:border-[#9A3412] bg-white'
                              }`}
                            >
                              <div className="font-mono tabular-nums text-[11px] text-[#78716C]">
                                {ev.date} · {ev.places.join('・')}
                              </div>
                              <div className="font-serif font-semibold text-sm text-[#1C1917] mt-0.5">
                                {ev.title}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {link.causalLinks.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#78716C] mb-1.5">
                        別地域への波及・つながり
                      </h4>
                      <ul className="space-y-2">
                        {link.causalLinks.map((flow, i) => (
                          <li
                            key={`${flow.fromEvent.id}-${flow.toEvent.id}-${i}`}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 bg-[#FBF9F5] border border-[#E6E0D6] rounded-md p-2.5 text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectEvent(flow.fromEvent.id)}
                              className="flex-1 min-w-0 text-left hover:text-[#9A3412] transition-colors"
                            >
                              <span className="text-[11px] text-[#78716C] block">
                                {shortenRegionTitle(flow.fromRegion)} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {flow.fromEvent.date}
                                </span>
                              </span>
                              <span className="font-serif font-semibold text-sm text-[#1C1917]">
                                {flow.fromEvent.title}
                              </span>
                            </button>

                            <ArrowRight
                              className="w-4 h-4 text-[#9A3412] shrink-0 rotate-90 sm:rotate-0"
                              aria-hidden="true"
                            />

                            <button
                              type="button"
                              onClick={() => onSelectEvent(flow.toEvent.id)}
                              className="flex-1 min-w-0 text-left hover:text-[#9A3412] transition-colors"
                            >
                              <span className="text-[11px] text-[#78716C] block">
                                {shortenRegionTitle(flow.toRegion)} ·{' '}
                                <span className="font-mono tabular-nums">
                                  {flow.toEvent.date}
                                </span>
                              </span>
                              <span className="font-serif font-semibold text-sm text-[#1C1917]">
                                {flow.toEvent.title}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Grouped Region Lanes (Full-Width Responsive Grid) */}
      {displayMode === 'lanes' && (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${
            visibleRegionGroups.length >= 3 ? 'xl:grid-cols-3' : ''
          }`}
        >
          {visibleRegionGroups.map((group) => {
            const neighbors = regionNeighborMap.get(group.region) ?? [];
            return (
              <section
                key={group.region}
                aria-label={`${group.region} の年表`}
                className="bg-white border border-[#E6E0D6] rounded-lg overflow-hidden flex flex-col"
              >
                <div className="px-4 py-3 bg-[#F4F0E8]/70 border-b border-[#E6E0D6] space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-serif font-bold text-[#1C1917]">
                      {group.region}
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-[#78716C]">
                      {group.events.length}件
                    </span>
                  </div>
                  {granularity === 'macro' && group.subPlaces.length > 0 && (
                    <div className="text-[11px] text-[#57534E]">
                      含まれる場所: {group.subPlaces.join('・')}
                    </div>
                  )}
                  {neighbors.length > 0 && (
                    <div className="text-[11px] text-[#78716C] flex flex-wrap items-center gap-x-2">
                      <span>関連の深い地域:</span>
                      {neighbors.slice(0, 3).map((n) => (
                        <button
                          key={n.target}
                          type="button"
                          onClick={() => {
                            setFocusedRelationId(n.linkId);
                            setFocusedNodeRegion(null);
                            setDisplayMode('relations');
                          }}
                          className="text-[#9A3412] hover:underline font-medium"
                        >
                          {shortenRegionTitle(n.target)} ({n.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 space-y-2.5 flex-1">
                  {group.events.map((ev) => {
                    const isSelected = ev.id === selectedEventId;
                    const isRelated = relatedEventIds.has(ev.id);
                    const isUnrelated =
                      Boolean(selectedEvent) && !isSelected && !isRelated;
                    const colorId = eventColors[ev.id];
                    const colorDef = colorId
                      ? COLOR_PALETTE.find((c) => c.id === colorId)
                      : undefined;

                    const laneFocusState = isSelected
                      ? 'selected'
                      : isRelated
                        ? 'related'
                        : isUnrelated
                          ? 'unrelated'
                          : 'none';

                    return (
                      <button
                        key={`${group.region}-${ev.id}`}
                        type="button"
                        data-focus-state={laneFocusState}
                        onClick={() => onSelectEvent(ev.id)}
                        aria-pressed={isSelected}
                        className={`w-full text-left p-3.5 rounded-md border transition-opacity duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C1917] ${
                          isUnrelated
                            ? 'opacity-40 hover:opacity-95 focus-visible:opacity-95'
                            : 'opacity-100'
                        } ${
                          isSelected
                            ? 'bg-[#FBF9F5] border-[#1C1917] ring-2 ring-[#1C1917]/80'
                            : isRelated
                              ? 'bg-[#EEF4FF] border-[#1D4ED8] ring-1 ring-[#1D4ED8]/50'
                              : 'bg-white border-[#E6E0D6] hover:border-[#A8A29E]'
                        }`}
                        style={
                          colorDef
                            ? {
                                backgroundColor: colorDef.surfaceHex,
                                borderColor: isSelected
                                  ? '#1C1917'
                                  : isRelated
                                    ? '#1D4ED8'
                                    : colorDef.borderHex,
                              }
                            : undefined
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1">
                          <span className="inline-flex flex-wrap items-center gap-x-2 font-mono tabular-nums font-medium text-[#57534E]">
                            <span>{ev.date}</span>
                            {ev.importance === 3 && (
                              <span
                                title="最重要"
                                aria-label="最重要"
                                className="inline-flex items-center text-[#9A3412]"
                              >
                                <Star
                                  className="w-3 h-3 fill-[#9A3412]"
                                  aria-hidden="true"
                                />
                              </span>
                            )}
                            {ev.places.length > 0 && (
                              <span className="font-sans text-[#78716C]">
                                {ev.places.join('・')}
                              </span>
                            )}
                            {isRelated && (
                              <span className="font-sans font-semibold text-[#1D4ED8]">
                                · 関連
                              </span>
                            )}
                          </span>
                          {colorDef && (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#1C1917]">
                              <span
                                className="w-2 h-2 rounded-[2px] shrink-0"
                                style={{ backgroundColor: colorDef.swatchHex }}
                                aria-hidden="true"
                              />
                              {colorLabels[colorDef.id] ||
                                colorDef.defaultLabel}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm sm:text-base font-serif font-semibold text-[#1C1917] leading-snug mb-1">
                          {ev.title}
                        </h3>

                        {ev.description && (
                          <p className="text-xs text-[#57534E] leading-relaxed line-clamp-2 mb-2">
                            {ev.description}
                          </p>
                        )}

                        {ev.people.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                            {ev.people.slice(0, 3).map((person) => (
                              <span
                                key={person}
                                className="inline-flex items-center gap-1"
                              >
                                {personProfiles[person]?.photoUrl && (
                                  <PersonAvatar
                                    name={person}
                                    photoUrl={personProfiles[person]?.photoUrl}
                                    size="xs"
                                  />
                                )}
                                <span>{person}</span>
                              </span>
                            ))}
                            {ev.people.length > 3 && (
                              <span className="text-[#78716C]">
                                他{ev.people.length - 3}名
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
