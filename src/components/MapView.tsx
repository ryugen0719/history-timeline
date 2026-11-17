import { useEffect, useMemo, useState } from 'react';
import {
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  Loader2,
  MapPin,
  Maximize,
  RefreshCw,
} from 'lucide-react';
import type {
  ColorLabelsMap,
  EventColorsMap,
  HistoricalEvent,
  PersonProfilesMap,
} from '../types/timeline';
import {
  collectPlaceEventGroups,
  getPlacePinAppearance,
  type PlaceEventGroup,
  type ResolvedPlaceLocation,
} from '../utils/mapPlaces';
import { useResolvedPlaces } from '../utils/placeGeocoding';
import { AdvancedMarkerWithRef } from './AdvancedMarkerWithRef';
import { EventDetailPanel } from './EventDetailPanel';

interface MapViewProps {
  events: HistoricalEvent[];
  allEvents: HistoricalEvent[];
  selectedEvent: HistoricalEvent | null;
  eventColors: EventColorsMap;
  colorLabels: ColorLabelsMap;
  personProfiles: PersonProfilesMap;
  mapsAvailable: boolean;
  onSelectEvent: (eventId: string) => void;
  onOpenMobileDetail: (eventId: string) => void;
  onAssignColor: (eventId: string, colorId: import('../types/timeline').ColorId) => void;
  onEditPersonPhoto: (personName: string) => void;
  onResetFilters: () => void;
}

interface ViewportTarget {
  mode: 'all' | 'event' | 'place';
  placeName?: string;
  nonce: number;
}

function MapViewportController({
  resolvedByPlace,
  allLocations,
  selectedEvent,
  target,
}: {
  resolvedByPlace: Record<string, ResolvedPlaceLocation>;
  allLocations: ResolvedPlaceLocation[];
  selectedEvent: HistoricalEvent | null;
  target: ViewportTarget;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map || !coreLib) return;

    let points: ResolvedPlaceLocation[] = [];

    if (target.mode === 'place' && target.placeName) {
      const one = resolvedByPlace[target.placeName];
      if (one) points = [one];
    } else if (target.mode === 'event' && selectedEvent) {
      points = selectedEvent.places
        .map((p) => resolvedByPlace[p.trim()])
        .filter((loc): loc is ResolvedPlaceLocation => Boolean(loc));
    }

    if (points.length === 0) {
      points = allLocations;
    }
    if (points.length === 0) return;

    if (points.length === 1) {
      map.panTo({ lat: points[0].lat, lng: points[0].lng });
      const targetZoom = target.mode === 'all' ? 6 : 9;
      map.setZoom(targetZoom);
      return;
    }

    const bounds = new coreLib.LatLngBounds();
    for (const loc of points) {
      bounds.extend({ lat: loc.lat, lng: loc.lng });
    }
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  }, [map, coreLib, resolvedByPlace, allLocations, selectedEvent, target]);

  return null;
}

export function MapView({
  events,
  allEvents,
  selectedEvent,
  eventColors,
  colorLabels,
  personProfiles,
  mapsAvailable,
  onSelectEvent,
  onOpenMobileDetail,
  onAssignColor,
  onEditPersonPhoto,
  onResetFilters,
}: MapViewProps) {
  const { mappableGroups, nonMappableEvents, allMappablePlaceNames } = useMemo(
    () => collectPlaceEventGroups(events, eventColors),
    [events, eventColors]
  );

  const {
    resolvedByPlace,
    unresolvedPlaces,
    isResolving,
    resolvedCount,
    totalMappableCount,
    retryPlaceLookup,
  } = useResolvedPlaces(allMappablePlaceNames, mapsAvailable && events.length > 0);

  const resolvedGroups = useMemo(
    () =>
      mappableGroups
        .map((group) => {
          const location = resolvedByPlace[group.placeName];
          return location ? { group, location } : null;
        })
        .filter(
          (
            item
          ): item is {
            group: PlaceEventGroup;
            location: ResolvedPlaceLocation;
          } => Boolean(item)
        )
        // Sort north-to-south so southern markers render cleanly in front
        .sort((a, b) => b.location.lat - a.location.lat),
    [mappableGroups, resolvedByPlace]
  );

  const allResolvedLocations = useMemo(
    () => resolvedGroups.map((item) => item.location),
    [resolvedGroups]
  );

  const [viewportTarget, setViewportTarget] = useState<ViewportTarget>({
    mode: 'all',
    nonce: 0,
  });
  const [activeInfoPlace, setActiveInfoPlace] = useState<{
    placeName: string;
    marker: google.maps.marker.AdvancedMarkerElement;
  } | null>(null);

  // When dataset or filters reduce events drastically, keep viewport fitted
  useEffect(() => {
    setActiveInfoPlace(null);
    setViewportTarget((prev) => ({ mode: 'all', nonce: prev.nonce + 1 }));
  }, [events.length]);

  const activeInfoItem = useMemo(
    () =>
      activeInfoPlace
        ? resolvedGroups.find(
            (item) => item.group.placeName === activeInfoPlace.placeName
          ) ?? null
        : null,
    [activeInfoPlace, resolvedGroups]
  );

  const selectedIndex = useMemo(() => {
    if (!selectedEvent) return -1;
    return events.findIndex((e) => e.id === selectedEvent.id);
  }, [events, selectedEvent]);

  const handleStepEvent = (delta: -1 | 1) => {
    if (events.length === 0) return;
    const baseIdx = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIdx = (baseIdx + delta + events.length) % events.length;
    const nextEvent = events[nextIdx];
    if (!nextEvent) return;
    onSelectEvent(nextEvent.id);
    setActiveInfoPlace(null);
    setViewportTarget((prev) => ({
      mode: 'event',
      nonce: prev.nonce + 1,
    }));
  };

  const handleFocusPlace = (placeName: string) => {
    const targetGroup = mappableGroups.find((g) => g.placeName === placeName);
    if (targetGroup && targetGroup.events.length > 0) {
      const currentBelongsHere =
        selectedEvent &&
        targetGroup.events.some((e) => e.id === selectedEvent.id);
      if (!currentBelongsHere) {
        onSelectEvent(targetGroup.events[0].id);
      }
    }
    setViewportTarget((prev) => ({
      mode: 'place',
      placeName,
      nonce: prev.nonce + 1,
    }));
  };

  if (events.length === 0) {
    return (
      <div className="bg-white border border-[#E6E0D6] rounded-lg p-12 text-center">
        <h2 className="text-lg font-serif font-semibold text-[#1C1917] mb-2">
          地図に表示できる出来事がありません
        </h2>
        <p className="text-sm text-[#57534E] mb-5">
          検索語や分野・色の絞り込み条件をリセットすると地図を表示できます。
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      {/* Left: Interactive Map Stage & Place Controls */}
      <div className="lg:col-span-7 xl:col-span-8 min-w-0 space-y-4">
        {/* Chronological Event Stepper + Fit All Control */}
        <div className="bg-white border border-[#E6E0D6] rounded-lg px-3.5 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => handleStepEvent(-1)}
              aria-label="前の出来事へ移動"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#FBF9F5] border border-[#D6CEBE] hover:border-[#1C1917] rounded text-[#1C1917] whitespace-nowrap shrink-0 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              前へ
            </button>

            <div className="min-w-0 flex-1 px-1">
              {selectedEvent ? (
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs font-mono tabular-nums text-[#78716C] shrink-0">
                    {selectedEvent.date}
                  </span>
                  <span className="text-sm font-serif font-semibold text-[#1C1917] truncate">
                    {selectedEvent.title}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[#78716C]">
                  ピンまたは下の地点名から出来事を選択
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleStepEvent(1)}
              aria-label="次の出来事へ移動"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#FBF9F5] border border-[#D6CEBE] hover:border-[#1C1917] rounded text-[#1C1917] whitespace-nowrap shrink-0 transition-colors"
            >
              次へ
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0 pt-2 border-t border-[#E6E0D6]/70 sm:pt-0 sm:border-t-0">
            {isResolving && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[#57534E] font-mono tabular-nums mr-auto sm:mr-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9A3412]" aria-hidden="true" />
                地点取得 {resolvedCount}/{totalMappableCount}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveInfoPlace(null);
                setViewportTarget((prev) => ({
                  mode: 'all',
                  nonce: prev.nonce + 1,
                }));
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-[#D6CEBE] hover:border-[#1C1917] rounded text-[#1C1917] whitespace-nowrap transition-colors"
            >
              <Maximize className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
              全体を表示
            </button>

            {selectedEvent && (
              <button
                type="button"
                onClick={() => onOpenMobileDetail(selectedEvent.id)}
                className="lg:hidden inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#1C1917] text-[#FBF9F5] rounded whitespace-nowrap"
              >
                詳細を見る
              </button>
            )}
          </div>
        </div>

        {/* Main Google Map Canvas (explicit non-zero height per CF2) */}
        <div
          data-testid="full-map-container"
          className="bg-white border border-[#E6E0D6] rounded-lg overflow-hidden relative w-full h-[420px] sm:h-[500px] lg:h-[560px]"
        >
          {!mapsAvailable ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#F4F0E8]/60">
              <Compass className="w-8 h-8 text-[#78716C] mb-3" aria-hidden="true" />
              <h2 className="text-base font-serif font-semibold text-[#1C1917] mb-1">
                Google Maps APIキーが未設定です
              </h2>
              <p className="text-xs text-[#57534E] max-w-md leading-relaxed">
                Google Maps Platform の有効化または環境変数 VITE_GOOGLE_MAPS_API_KEY の設定後にマップが表示されます。
              </p>
            </div>
          ) : (
            <GoogleMap
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={{ lat: 35.68, lng: 139.76 }}
              defaultZoom={5}
              gestureHandling="greedy"
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={true}
              clickableIcons={false}
              style={{ width: '100%', height: '100%' }}
              onClick={() => setActiveInfoPlace(null)}
            >
              <MapViewportController
                resolvedByPlace={resolvedByPlace}
                allLocations={allResolvedLocations}
                selectedEvent={selectedEvent}
                target={viewportTarget}
              />

              {resolvedGroups.map(({ group, location }) => {
                const appearance = getPlacePinAppearance({
                  group,
                  selectedEventId: selectedEvent?.id ?? null,
                  eventColors,
                });

                return (
                  <AdvancedMarkerWithRef
                    key={group.placeName}
                    position={{ lat: location.lat, lng: location.lng }}
                    title={`${group.placeName}（${group.events.length}件）`}
                    zIndex={appearance.isSelected ? 1000 : 10 + group.events.length}
                    onMarkerClick={(marker) => {
                      setActiveInfoPlace({
                        placeName: group.placeName,
                        marker,
                      });
                      const first = group.events[0];
                      if (
                        first &&
                        (!selectedEvent ||
                          !group.events.some((e) => e.id === selectedEvent.id))
                      ) {
                        onSelectEvent(first.id);
                      }
                    }}
                  >
                    <Pin
                      background={appearance.background}
                      borderColor={appearance.borderColor}
                      glyphColor={appearance.glyphColor}
                      scale={appearance.scale}
                      glyphText={
                        group.events.length > 1
                          ? String(group.events.length)
                          : appearance.isSelected
                            ? '★'
                            : undefined
                      }
                    />
                  </AdvancedMarkerWithRef>
                );
              })}

              {activeInfoItem && activeInfoPlace && (
                <InfoWindow
                  anchor={activeInfoPlace.marker}
                  maxWidth={290}
                  onCloseClick={() => setActiveInfoPlace(null)}
                >
                  <div className="space-y-2 text-[#1C1917] max-w-[260px]">
                    <div>
                      <div className="text-sm font-serif font-bold">
                        {activeInfoItem.group.placeName}
                      </div>
                      {activeInfoItem.location.formattedAddress && (
                        <div className="text-[11px] text-[#57534E] leading-snug mt-0.5">
                          {activeInfoItem.location.formattedAddress}
                        </div>
                      )}
                    </div>

                    <ul className="divide-y divide-[#E6E0D6] border-t border-[#E6E0D6] max-h-44 overflow-y-auto">
                      {activeInfoItem.group.events.map((ev) => {
                        const isSelected = selectedEvent?.id === ev.id;
                        return (
                          <li key={ev.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectEvent(ev.id);
                                onOpenMobileDetail(ev.id);
                              }}
                              className={`w-full text-left py-1.5 px-1 transition-colors rounded ${
                                isSelected
                                  ? 'bg-[#F4F0E8] font-semibold text-[#9A3412]'
                                  : 'hover:bg-[#FBF9F5]'
                              }`}
                            >
                              <div className="text-[11px] font-mono tabular-nums text-[#78716C]">
                                {ev.date}
                              </div>
                              <div className="text-xs leading-snug">
                                {ev.title}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {activeInfoItem.location.attributions.length > 0 && (
                      <div className="text-[10px] text-[#78716C] pt-1 border-t border-[#E6E0D6]">
                        {activeInfoItem.location.attributions.map((a, idx) => (
                          <span key={idx}>
                            {idx > 0 ? ', ' : ''}
                            {a.providerURI ? (
                              <a
                                href={a.providerURI}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                {a.provider}
                              </a>
                            ) : (
                              a.provider
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>

        {/* Mapped Place Index + Non-mappable Nationwide/Unknown Events */}
        <section
          aria-label="地図上の地点一覧"
          className="bg-white border border-[#E6E0D6] rounded-lg p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-serif font-semibold text-[#1C1917] flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
              地点から探す
              <span className="text-xs font-mono tabular-nums font-normal text-[#78716C]">
                （{resolvedGroups.length}/{mappableGroups.length}地点）
              </span>
            </h2>

            {unresolvedPlaces.length > 0 && (
              <button
                type="button"
                onClick={() => retryPlaceLookup()}
                className="inline-flex items-center gap-1 text-xs text-[#9A3412] hover:underline underline-offset-2"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                未取得地点を再取得（{unresolvedPlaces.length}）
              </button>
            )}
          </div>

          {mappableGroups.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {mappableGroups.map((group) => {
                const isResolved = Boolean(resolvedByPlace[group.placeName]);
                const containsSelected = Boolean(
                  selectedEvent &&
                    group.events.some((e) => e.id === selectedEvent.id)
                );
                return (
                  <button
                    key={group.placeName}
                    type="button"
                    disabled={!isResolved}
                    onClick={() => handleFocusPlace(group.placeName)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
                      containsSelected
                        ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917] font-medium'
                        : isResolved
                          ? 'bg-[#FBF9F5] text-[#1C1917] border-[#D6CEBE] hover:border-[#9A3412]'
                          : 'bg-[#F4F0E8]/60 text-[#A8A29E] border-[#E6E0D6] cursor-default'
                    }`}
                  >
                    <span>{group.placeName}</span>
                    <span className="font-mono tabular-nums text-[11px] opacity-75">
                      {group.events.length}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[#78716C]">
              現在の絞り込み結果には具体的な地名を持つ出来事がありません。
            </p>
          )}

          {nonMappableEvents.length > 0 && (
            <div className="pt-3 border-t border-[#E6E0D6] space-y-1.5">
              <div className="text-xs font-medium text-[#78716C]">
                広域・場所不明の出来事（ピン対象外）
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {nonMappableEvents.map((ev) => {
                  const active = selectedEvent?.id === ev.id;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        onSelectEvent(ev.id);
                        onOpenMobileDetail(ev.id);
                      }}
                      className={`text-left hover:text-[#9A3412] transition-colors ${
                        active
                          ? 'font-semibold text-[#9A3412] underline underline-offset-2'
                          : 'text-[#57534E]'
                      }`}
                    >
                      <span className="font-mono tabular-nums mr-1">
                        {ev.date}
                      </span>
                      <span>{ev.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Right: Sticky Event Detail Inspector (without duplicate mini-map) */}
      <aside
        aria-label="出来事の詳細インスペクター"
        className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto archival-scroll"
      >
        <EventDetailPanel
          event={selectedEvent}
          allEvents={allEvents}
          eventColors={eventColors}
          colorLabels={colorLabels}
          personProfiles={personProfiles}
          mapsAvailable={mapsAvailable}
          showMiniMap={false}
          onAssignColor={onAssignColor}
          onEditPersonPhoto={onEditPersonPhoto}
          onSelectEvent={(id) => {
            onSelectEvent(id);
            setViewportTarget((prev) => ({
              mode: 'event',
              nonce: prev.nonce + 1,
            }));
          }}
        />
      </aside>
    </div>
  );
}
