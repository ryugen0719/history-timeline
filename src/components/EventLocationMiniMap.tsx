import { useEffect, useMemo, useState } from 'react';
import {
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Loader2, MapPin, Maximize2 } from 'lucide-react';
import type { HistoricalEvent } from '../types/timeline';
import { isMappablePlaceName, type ResolvedPlaceLocation } from '../utils/mapPlaces';
import { useResolvedPlaces } from '../utils/placeGeocoding';
import { AdvancedMarkerWithRef } from './AdvancedMarkerWithRef';

interface EventLocationMiniMapProps {
  event: HistoricalEvent;
  mapsAvailable: boolean;
  onOpenFullMap?: () => void;
}

function MiniMapViewportController({
  locations,
  focusedPlaceName,
}: {
  locations: ResolvedPlaceLocation[];
  focusedPlaceName: string | null;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');

  useEffect(() => {
    if (!map || !coreLib || locations.length === 0) return;

    if (focusedPlaceName) {
      const target = locations.find((l) => l.placeName === focusedPlaceName);
      if (target) {
        map.panTo({ lat: target.lat, lng: target.lng });
        map.setZoom(10);
        return;
      }
    }

    if (locations.length === 1) {
      map.panTo({ lat: locations[0].lat, lng: locations[0].lng });
      map.setZoom(9);
      return;
    }

    const bounds = new coreLib.LatLngBounds();
    for (const loc of locations) {
      bounds.extend({ lat: loc.lat, lng: loc.lng });
    }
    map.fitBounds(bounds, { top: 28, right: 28, bottom: 28, left: 28 });
  }, [map, coreLib, locations, focusedPlaceName]);

  return null;
}

export function EventLocationMiniMap({
  event,
  mapsAvailable,
  onOpenFullMap,
}: EventLocationMiniMapProps) {
  const mappablePlaceNames = useMemo(
    () =>
      Array.from(
        new Set(event.places.map((p) => p.trim()).filter(isMappablePlaceName))
      ),
    [event.places]
  );

  const { resolvedByPlace, isResolving } = useResolvedPlaces(
    mappablePlaceNames,
    mapsAvailable && mappablePlaceNames.length > 0
  );

  const resolvedLocations = useMemo(
    () =>
      mappablePlaceNames
        .map((name) => resolvedByPlace[name])
        .filter((item): item is ResolvedPlaceLocation => Boolean(item)),
    [mappablePlaceNames, resolvedByPlace]
  );

  const [focusedPlaceName, setFocusedPlaceName] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<{
    loc: ResolvedPlaceLocation;
    marker: google.maps.marker.AdvancedMarkerElement;
  } | null>(null);

  useEffect(() => {
    setFocusedPlaceName(null);
    setSelectedPin(null);
  }, [event.id]);

  if (event.places.length === 0 && mappablePlaceNames.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="出来事の場所マップ"
      className="pt-4 border-t border-[#E6E0D6]"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin
            className="w-3.5 h-3.5 text-[#9A3412] shrink-0"
            aria-hidden="true"
          />
          <h3 className="text-xs font-semibold text-[#78716C] whitespace-nowrap">
            関係する場所
          </h3>
          {isResolving && (
            <Loader2
              className="w-3 h-3 text-[#78716C] animate-spin shrink-0"
              aria-label="位置情報を取得中"
            />
          )}
        </div>

        {onOpenFullMap && mappablePlaceNames.length > 0 && (
          <button
            type="button"
            onClick={onOpenFullMap}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#9A3412] hover:text-[#7C2D12] hover:underline underline-offset-2 whitespace-nowrap shrink-0"
          >
            <Maximize2 className="w-3 h-3" aria-hidden="true" />
            大きいマップで見る
          </button>
        )}
      </div>

      {/* Interactive place jump text links (no static pills) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#57534E] mb-2.5">
        {event.places.map((rawPlace, idx) => {
          const clean = rawPlace.trim();
          const hasCoord = Boolean(resolvedByPlace[clean]);
          const isFocused = focusedPlaceName === clean;
          return (
            <span key={`${clean}-${idx}`} className="inline-flex items-center gap-2">
              {idx > 0 && <span aria-hidden="true">·</span>}
              {hasCoord ? (
                <button
                  type="button"
                  onClick={() =>
                    setFocusedPlaceName((prev) => (prev === clean ? null : clean))
                  }
                  className={`underline-offset-2 transition-colors ${
                    isFocused
                      ? 'text-[#9A3412] font-semibold underline'
                      : 'text-[#1C1917] hover:text-[#9A3412] hover:underline'
                  }`}
                >
                  {clean}
                </button>
              ) : (
                <span>{clean}</span>
              )}
            </span>
          );
        })}
      </div>

      {!mapsAvailable ? (
        <div className="h-24 rounded-md border border-[#E6E0D6] bg-[#F4F0E8]/60 flex items-center justify-center px-3 text-center text-xs text-[#78716C]">
          Google Maps APIキーが設定されていないため地図を表示できません。
        </div>
      ) : mappablePlaceNames.length === 0 ? (
        <div className="rounded-md border border-[#E6E0D6] bg-[#F4F0E8]/50 px-3 py-2.5 text-xs text-[#78716C]">
          広域・場所不明の出来事のため、地図上のピン表示はありません。
        </div>
      ) : (
        <div
          data-testid="sidepanel-minimap"
          className="relative w-full h-44 rounded-md overflow-hidden border border-[#E6E0D6] bg-[#F4F0E8]"
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={{ lat: 35.68, lng: 139.76 }}
            defaultZoom={5}
            disableDefaultUI={true}
            zoomControl={true}
            gestureHandling="cooperative"
            clickableIcons={false}
            style={{ width: '100%', height: '100%' }}
            onClick={() => setSelectedPin(null)}
          >
            <MiniMapViewportController
              locations={resolvedLocations}
              focusedPlaceName={focusedPlaceName}
            />

            {resolvedLocations.map((loc) => (
              <AdvancedMarkerWithRef
                key={loc.placeName}
                position={{ lat: loc.lat, lng: loc.lng }}
                title={loc.placeName}
                zIndex={focusedPlaceName === loc.placeName ? 100 : 10}
                onMarkerClick={(marker) => setSelectedPin({ loc, marker })}
              >
                <Pin
                  background="#9A3412"
                  borderColor="#7C2D12"
                  glyphColor="#FBF9F5"
                  scale={focusedPlaceName === loc.placeName ? 1.15 : 0.9}
                />
              </AdvancedMarkerWithRef>
            ))}

            {selectedPin && (
              <InfoWindow
                anchor={selectedPin.marker}
                maxWidth={220}
                onCloseClick={() => setSelectedPin(null)}
              >
                <div className="text-xs text-[#1C1917] space-y-1">
                  <div className="font-semibold">{selectedPin.loc.placeName}</div>
                  {selectedPin.loc.formattedAddress && (
                    <div className="text-[11px] text-[#57534E]">
                      {selectedPin.loc.formattedAddress}
                    </div>
                  )}
                  {selectedPin.loc.attributions.length > 0 && (
                    <div className="text-[10px] text-[#78716C]">
                      {selectedPin.loc.attributions.map((a, idx) => (
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
        </div>
      )}
    </section>
  );
}
