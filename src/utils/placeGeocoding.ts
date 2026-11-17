import { useEffect, useMemo, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  buildPlaceSearchQuery,
  isMappablePlaceName,
  type ResolvedPlaceLocation,
} from './mapPlaces';

const GEOCODE_CACHE_KEY = 'history_timeline_archive_geocode_v1';
// Google Maps Platform Terms limit geospatial coordinate caching to 30 consecutive calendar days.
// Use a 7-day TTL to stay well within compliance limits while conserving quota.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type GeocodeCacheStore = Record<string, ResolvedPlaceLocation>;

const inFlightLookups: Record<
  string,
  Promise<ResolvedPlaceLocation | null> | undefined
> = {};
const sessionNotFoundPlaces: Record<string, boolean> = {};

function readGeocodeCache(): GeocodeCacheStore {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GeocodeCacheStore;
    const now = Date.now();
    const valid: GeocodeCacheStore = {};
    let pruned = false;

    for (const [key, entry] of Object.entries(parsed)) {
      if (
        entry &&
        typeof entry.lat === 'number' &&
        typeof entry.lng === 'number' &&
        typeof entry.cachedAt === 'number' &&
        now - entry.cachedAt < CACHE_TTL_MS
      ) {
        valid[key] = entry;
      } else {
        pruned = true;
      }
    }

    if (pruned) {
      localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch {
    return {};
  }
}

function writeGeocodeCacheEntry(entry: ResolvedPlaceLocation): void {
  try {
    const store = readGeocodeCache();
    store[entry.placeName] = entry;
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

function isQuotaError(err: unknown): boolean {
  const msg = String(err ?? '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('quota')
  );
}

async function resolveSinglePlace(
  placeName: string,
  placesLib: google.maps.PlacesLibrary
): Promise<ResolvedPlaceLocation | null> {
  const cached = readGeocodeCache()[placeName];
  if (cached) return cached;

  if (sessionNotFoundPlaces[placeName]) {
    return null;
  }

  const existing = inFlightLookups[placeName];
  if (existing) {
    return existing;
  }

  const task = (async (): Promise<ResolvedPlaceLocation | null> => {
    const query = buildPlaceSearchQuery(placeName);
    if (!query) return null;

    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: query,
        fields: ['id', 'displayName', 'formattedAddress', 'location'],
        maxResultCount: 1,
        language: 'ja',
      });

      const first = places?.[0];
      const loc = first?.location;
      if (!first || !loc) {
        sessionNotFoundPlaces[placeName] = true;
        return null;
      }

      const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
      const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        sessionNotFoundPlaces[placeName] = true;
        return null;
      }

      const attributions = Array.isArray(first.attributions)
        ? first.attributions
            .map((a) => ({
              provider: a.provider ?? '',
              providerURI: a.providerURI ?? null,
            }))
            .filter((a) => a.provider !== '')
        : [];

      const resolved: ResolvedPlaceLocation = {
        placeName,
        query,
        lat,
        lng,
        placeId: first.id ?? '',
        displayName: first.displayName ?? placeName,
        formattedAddress: first.formattedAddress ?? '',
        attributions,
        cachedAt: Date.now(),
      };

      writeGeocodeCacheEntry(resolved);
      return resolved;
    } catch (err) {
      if (isQuotaError(err)) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      sessionNotFoundPlaces[placeName] = true;
      return null;
    } finally {
      delete inFlightLookups[placeName];
    }
  })();

  inFlightLookups[placeName] = task;
  return task;
}

export interface UseResolvedPlacesResult {
  resolvedByPlace: Record<string, ResolvedPlaceLocation>;
  unresolvedPlaces: string[];
  isResolving: boolean;
  resolvedCount: number;
  totalMappableCount: number;
  retryPlaceLookup: (placeName?: string) => void;
}

export function useResolvedPlaces(
  placeNames: string[],
  enabled = true
): UseResolvedPlacesResult {
  const placesLib = useMapsLibrary('places');
  const [cacheVersion, setCacheVersion] = useState(0);
  const [isResolving, setIsResolving] = useState(false);

  const uniqueMappableNames = useMemo(() => {
    const seen: Record<string, true> = {};
    const list: string[] = [];
    for (const raw of placeNames) {
      const clean = raw.trim();
      if (!isMappablePlaceName(clean) || seen[clean]) continue;
      seen[clean] = true;
      list.push(clean);
    }
    return list;
  }, [placeNames]);

  const [resolvedByPlace, setResolvedByPlace] = useState<
    Record<string, ResolvedPlaceLocation>
  >(() => readGeocodeCache());

  useEffect(() => {
    setResolvedByPlace(readGeocodeCache());
  }, [cacheVersion]);

  useEffect(() => {
    if (!enabled || !placesLib || uniqueMappableNames.length === 0) {
      setIsResolving(false);
      return;
    }

    const cache = readGeocodeCache();
    const missing = uniqueMappableNames.filter(
      (name) => !cache[name] && !sessionNotFoundPlaces[name]
    );

    if (missing.length === 0) {
      setResolvedByPlace((prev) => ({ ...prev, ...cache }));
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);

    const runBatch = async () => {
      const queue = [...missing];
      const concurrency = 4;

      const worker = async () => {
        while (queue.length > 0 && !cancelled) {
          const nextName = queue.shift();
          if (!nextName) break;
          const result = await resolveSinglePlace(nextName, placesLib);
          if (!cancelled && result) {
            setResolvedByPlace((prev) => ({
              ...prev,
              [result.placeName]: result,
            }));
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length) }, () =>
          worker()
        )
      );

      if (!cancelled) {
        setIsResolving(false);
      }
    };

    void runBatch();

    return () => {
      cancelled = true;
    };
  }, [enabled, placesLib, uniqueMappableNames, cacheVersion]);

  const unresolvedPlaces = useMemo(
    () =>
      uniqueMappableNames.filter(
        (name) => !resolvedByPlace[name] && sessionNotFoundPlaces[name]
      ),
    [uniqueMappableNames, resolvedByPlace, isResolving]
  );

  const resolvedCount = useMemo(
    () => uniqueMappableNames.filter((name) => Boolean(resolvedByPlace[name])).length,
    [uniqueMappableNames, resolvedByPlace]
  );

  const retryPlaceLookup = (placeName?: string) => {
    if (placeName) {
      delete sessionNotFoundPlaces[placeName];
    } else {
      for (const name of uniqueMappableNames) {
        delete sessionNotFoundPlaces[name];
      }
    }
    setCacheVersion((v) => v + 1);
  };

  return {
    resolvedByPlace,
    unresolvedPlaces,
    isResolving,
    resolvedCount,
    totalMappableCount: uniqueMappableNames.length,
    retryPlaceLookup,
  };
}
