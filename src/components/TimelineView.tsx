import { useMemo } from 'react';
import {
  BookOpen,
  Coins,
  Crown,
  FlaskConical,
  GraduationCap,
  Handshake,
  Landmark,
  Palette,
  Scale,
  ScrollText,
  ShieldAlert,
  Ship,
  Star,
  Swords,
  TrainFront,
  Users,
} from 'lucide-react';
import {
  COLOR_PALETTE,
  type ColorLabelsMap,
  type EventColorsMap,
  type HistoricalEvent,
  type PersonProfilesMap,
  type TimelineGroupMode,
} from '../types/timeline';
import { resolveEventIcon, type EventIconKind } from '../utils/eventIcon';
import { findRelatedEventIdsForHighlight } from '../utils/regionGrouping';
import {
  getEventFocusRelation,
  groupEventsByColor,
  groupEventsByEra,
} from '../utils/timelineParser';
import { PersonAvatar } from './PersonAvatar';

const ICON_COMPONENTS: Record<EventIconKind, typeof Landmark> = {
  ship: Ship,
  handshake: Handshake,
  scroll: ScrollText,
  scale: Scale,
  'shield-alert': ShieldAlert,
  swords: Swords,
  train: TrainFront,
  graduation: GraduationCap,
  coins: Coins,
  flask: FlaskConical,
  palette: Palette,
  book: BookOpen,
  crown: Crown,
  users: Users,
  landmark: Landmark,
};

interface TimelineViewProps {
  events: HistoricalEvent[];
  allEvents: HistoricalEvent[];
  selectedEventId: string | null;
  groupMode: TimelineGroupMode;
  eventColors: EventColorsMap;
  colorLabels: ColorLabelsMap;
  personProfiles: PersonProfilesMap;
  onSelectEvent: (eventId: string) => void;
  onClearSelection?: () => void;
  onOpenColorEdit: () => void;
  onResetFilters: () => void;
}

export function TimelineView({
  events,
  allEvents,
  selectedEventId,
  groupMode,
  eventColors,
  colorLabels,
  personProfiles,
  onSelectEvent,
  onClearSelection,
  onOpenColorEdit,
  onResetFilters,
}: TimelineViewProps) {
  const selectedEvent = useMemo(
    () =>
      selectedEventId
        ? events.find((e) => e.id === selectedEventId) ??
          allEvents.find((e) => e.id === selectedEventId) ??
          null
        : null,
    [events, allEvents, selectedEventId]
  );

  const relatedEventIds = useMemo(
    () => findRelatedEventIdsForHighlight(selectedEvent, allEvents),
    [selectedEvent, allEvents]
  );

  if (events.length === 0) {
    return (
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-12 text-center">
        <h2 className="text-lg font-serif font-semibold text-[#1C1917] mb-2">
          該当する出来事が見つかりませんでした
        </h2>
        <p className="text-sm text-[#57534E] mb-5">
          検索語や分野・色の絞り込みを変更してお試しください。
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

  const sections =
    groupMode === 'color'
      ? groupEventsByColor(events, eventColors, colorLabels).map((g) => ({
          key: g.colorId,
          title: g.label,
          swatchHex: g.swatchHex,
          events: g.events,
        }))
      : groupEventsByEra(events).map((g) => ({
          key: g.eraLabel,
          title: g.eraLabel,
          swatchHex: null as string | null,
          events: g.events,
        }));

  const hasAnyColoredInView = events.some((ev) => Boolean(eventColors[ev.id]));
  const visibleRelatedCount = events.filter((ev) =>
    relatedEventIds.has(ev.id)
  ).length;

  return (
    <div className="space-y-7" data-testid="timeline-list">
      <div
        className="flex flex-wrap items-center justify-between gap-2 min-h-[38px] px-3.5 py-2 bg-[#F4F0E8]/75 border border-[#E6E0D6] rounded-md text-xs text-[#44403C]"
        data-testid="timeline-focus-banner"
        data-active={Boolean(selectedEvent)}
      >
        {selectedEvent ? (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <span>
                選択中:{' '}
                <strong className="font-serif text-[#1C1917]">
                  {selectedEvent.title}
                </strong>
              </span>
              {visibleRelatedCount > 0 ? (
                <span className="font-medium text-[#1D4ED8]">
                  関連する出来事 {visibleRelatedCount}件を強調中（もう一度タップで解除）
                </span>
              ) : (
                <span className="text-[#78716C]">
                  選択中のみ強調表示（もう一度タップで解除）
                </span>
              )}
            </div>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs font-medium text-[#57534E] hover:text-[#1C1917] underline underline-offset-2 shrink-0"
              >
                選択を解除
              </button>
            )}
          </>
        ) : (
          <span className="text-[#78716C]">
            出来事をタップすると関連する出来事を強調表示し、それ以外を薄く表示します
          </span>
        )}
      </div>

      {groupMode === 'color' && !hasAnyColoredInView && (
        <div className="bg-white border border-[#D6CEBE] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-[#44403C]">
            まだ色分けが設定されていないため、すべて「未分類」に表示されています。
          </div>
          <button
            type="button"
            onClick={onOpenColorEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] hover:bg-[#9A3412] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            色分け編集を開く
          </button>
        </div>
      )}

      {sections.map((section) => {
        const hasFocusedEventInSection =
          !selectedEvent ||
          section.events.some(
            (ev) => ev.id === selectedEvent.id || relatedEventIds.has(ev.id)
          );

        return (
          <section key={section.key} aria-label={section.title}>
            {/* Quiet Section Header */}
            <div
              className={`flex items-baseline justify-between border-b border-[#D6CEBE] pb-1.5 mb-4 transition-opacity duration-100 ${
                hasFocusedEventInSection ? 'opacity-100' : 'opacity-45'
              }`}
            >
              <h2 className="text-lg sm:text-xl font-serif font-bold text-[#1C1917] inline-flex items-center gap-2">
                {section.swatchHex && (
                  <span
                    className="w-3 h-3 rounded-[2px] shrink-0"
                    style={{ backgroundColor: section.swatchHex }}
                    aria-hidden="true"
                  />
                )}
                <span>{section.title}</span>
              </h2>
              <span className="text-xs font-mono tabular-nums text-[#78716C]">
                {section.events.length}件
              </span>
            </div>

            {/* Chronological Rows */}
            <div className="relative space-y-3.5">
              {section.events.map((ev, index) => {
                const focusRelation = getEventFocusRelation(
                  ev,
                  selectedEvent,
                  relatedEventIds
                );
                const isSelected = focusRelation === 'selected';
                const isRelated =
                  focusRelation === 'related-before' ||
                  focusRelation === 'related-after' ||
                  focusRelation === 'related';
                const isUnrelated = focusRelation === 'unrelated';
                const isLast = index === section.events.length - 1;
                const assignedColorId = eventColors[ev.id];
                const colorDef = assignedColorId
                  ? COLOR_PALETTE.find((c) => c.id === assignedColorId)
                  : undefined;

                const relatedLabel =
                  focusRelation === 'related-before'
                    ? '関連（前の経緯）'
                    : focusRelation === 'related-after'
                      ? '関連（次の展開）'
                      : '関連';

                return (
                  <div
                    key={`${section.key}-${ev.id}`}
                    data-focus-state={focusRelation}
                    className={`relative flex items-stretch gap-3 sm:gap-5 transition-opacity duration-100 ${
                      isUnrelated
                        ? 'opacity-40 hover:opacity-95 focus-within:opacity-95'
                        : 'opacity-100'
                    }`}
                  >
                    {/* Left Date Column */}
                    <div className="w-20 sm:w-28 shrink-0 pt-3.5 text-right">
                      <div
                        className={`text-xs sm:text-sm font-mono tabular-nums leading-tight break-words ${
                          isSelected
                            ? 'font-bold text-[#1C1917]'
                            : isRelated
                              ? 'font-semibold text-[#1D4ED8]'
                              : 'font-medium text-[#1C1917]'
                        }`}
                      >
                        {ev.date}
                      </div>
                      {ev.date_precision === 'unknown' && (
                        <div className="text-[11px] text-[#78716C] mt-0.5">
                          年代不明
                        </div>
                      )}
                    </div>

                    {/* Vertical Hairline Spine & Geometric Importance Marker */}
                    <div
                      className="relative flex flex-col items-center shrink-0 w-4 pt-4"
                      aria-hidden="true"
                    >
                      {!isLast && (
                        <div className="absolute top-6 bottom-[-1.35rem] w-px bg-[#D6CEBE]" />
                      )}
                      <div
                        className={`relative z-10 rotate-45 ${
                          ev.importance === 3
                            ? 'w-3 h-3 bg-[#9A3412] border border-[#9A3412]'
                            : ev.importance === 2
                              ? 'w-2.5 h-2.5 bg-[#FBF9F5] border-2 border-[#57534E]'
                              : 'w-2 h-2 bg-[#D6CEBE] border border-[#78716C]'
                        } ${
                          isSelected
                            ? 'scale-125 ring-4 ring-[#1C1917]/15'
                            : isRelated
                              ? 'scale-115 ring-4 ring-[#1D4ED8]/20'
                              : ''
                        }`}
                        style={
                          isRelated && !colorDef
                            ? {
                                backgroundColor:
                                  ev.importance === 2 ? '#FBF9F5' : '#1D4ED8',
                                borderColor: '#1D4ED8',
                              }
                            : colorDef
                              ? {
                                  backgroundColor:
                                    ev.importance === 2
                                      ? '#FBF9F5'
                                      : colorDef.swatchHex,
                                  borderColor: colorDef.swatchHex,
                                }
                              : undefined
                        }
                      />
                    </div>

                    {/* Focused Study Event Card (preserves color tint even when selected/related) */}
                    {(() => {
                      const iconMeta = resolveEventIcon(ev);
                      const ItemIcon = ICON_COMPONENTS[iconMeta.kind];

                      return (
                        <button
                          type="button"
                          onClick={() => onSelectEvent(ev.id)}
                          aria-pressed={isSelected}
                          className={`flex-1 min-w-0 text-left rounded-lg border px-4 py-3 sm:px-5 sm:py-3.5 transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1C1917] ${
                            isSelected
                              ? 'bg-white border-[#1C1917] ring-2 ring-[#1C1917]/80 shadow-sm'
                              : isRelated
                                ? 'bg-[#F5F8FF] border-[#1D4ED8] ring-1 ring-[#1D4ED8]/45 shadow-xs hover:bg-[#EDF3FF]'
                                : 'bg-white/90 border-[#E6E0D6] hover:bg-white hover:border-[#A8A29E]'
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
                          <div className="flex items-start gap-3">
                            <span
                              title={iconMeta.label}
                              aria-hidden="true"
                              className={`w-8 h-8 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                isRelated && !colorDef
                                  ? 'bg-white border-[#1D4ED8]/40 text-[#1D4ED8]'
                                  : colorDef
                                    ? 'bg-white/80'
                                    : ev.importance === 3
                                      ? 'bg-[#F4F0E8] border-[#D6CEBE] text-[#9A3412]'
                                      : 'bg-[#F4F0E8]/70 border-[#E6E0D6] text-[#57534E]'
                              }`}
                              style={
                                colorDef
                                  ? {
                                      color: colorDef.swatchHex,
                                      borderColor: colorDef.borderHex,
                                    }
                                  : undefined
                              }
                            >
                              <ItemIcon className="w-4 h-4" />
                            </span>

                            <div className="flex-1 min-w-0">
                              {/* Title Row (+ Related, Importance & Color labels cleanly separated) */}
                              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                                <h3 className="text-base sm:text-lg font-serif font-semibold text-[#1C1917] leading-snug">
                                  {ev.title}
                                </h3>

                                <div className="flex items-center gap-2 text-[11px] shrink-0">
                                  {isRelated && (
                                    <span className="font-semibold text-[#1D4ED8]">
                                      {relatedLabel}
                                    </span>
                                  )}
                                  {isRelated &&
                                    (ev.importance === 3 || colorDef) && (
                                      <span
                                        className="text-[#A8A29E]"
                                        aria-hidden="true"
                                      >
                                        ·
                                      </span>
                                    )}
                                  {ev.importance === 3 && (
                                    <span
                                      title="最重要"
                                      aria-label="最重要"
                                      className="inline-flex items-center text-[#9A3412]"
                                    >
                                      <Star
                                        className="w-3.5 h-3.5 fill-[#9A3412]"
                                        aria-hidden="true"
                                      />
                                    </span>
                                  )}
                                  {ev.importance === 3 && colorDef && (
                                    <span
                                      className="text-[#A8A29E]"
                                      aria-hidden="true"
                                    >
                                      ·
                                    </span>
                                  )}
                                  {colorDef && (
                                    <span className="inline-flex items-center gap-1.5 font-medium text-[#1C1917]">
                                      <span
                                        className="w-2 h-2 rounded-[2px] shrink-0"
                                        style={{
                                          backgroundColor: colorDef.swatchHex,
                                        }}
                                        aria-hidden="true"
                                      />
                                      {colorLabels[colorDef.id] ||
                                        colorDef.defaultLabel}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Concise 2-line Description */}
                              {ev.description && (
                                <p className="text-sm text-[#44403C] leading-relaxed line-clamp-2">
                                  {ev.description}
                                </p>
                              )}

                              {/* People Row (with Portrait Thumbnails when registered) */}
                              {ev.people.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#57534E]">
                                  {ev.people.slice(0, 4).map((person) => (
                                    <span
                                      key={person}
                                      className="inline-flex items-center gap-1"
                                    >
                                      {personProfiles[person]?.photoUrl && (
                                        <PersonAvatar
                                          name={person}
                                          photoUrl={
                                            personProfiles[person]?.photoUrl
                                          }
                                          size="xs"
                                        />
                                      )}
                                      <span>{person}</span>
                                    </span>
                                  ))}
                                  {ev.people.length > 4 && (
                                    <span className="text-[#78716C]">
                                      他{ev.people.length - 4}名
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
