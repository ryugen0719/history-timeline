import {
  COLOR_PALETTE,
  type AssignedColorId,
  type EventColorsMap,
  type HistoricalEvent,
  type ImportanceLevel,
} from '../types/timeline';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface ResolvedPlaceLocation {
  placeName: string;
  query: string;
  lat: number;
  lng: number;
  placeId: string;
  displayName: string;
  formattedAddress: string;
  attributions: Array<{ provider: string; providerURI: string | null }>;
  cachedAt: number;
}

const NON_MAPPABLE_EXACT = new Set([
  '',
  '不明',
  '場所不明',
  '全国',
  '日本全国',
  '全国各藩',
  '全国諸藩',
  '各地',
  '日本各地',
  'ヨーロッパ各地',
  '欧州各地',
  '世界各地',
]);

const HISTORICAL_PLACE_QUERY_HINTS: Record<string, string> = {
  江戸: '江戸城 東京都千代田区',
  江戸湾: '東京湾',
  浦賀: '浦賀 神奈川県横須賀市',
  下田: '下田市 静岡県',
  箱館: '函館市 北海道',
  大坂: '大阪市 大阪府',
  兵庫: '神戸市 兵庫県',
  神奈川: '横浜市神奈川区 神奈川県',
  薩摩: '鹿児島県 薩摩',
  長州: '山口県萩市 長州',
  土佐: '高知県 土佐',
  肥前: '佐賀県',
  会津: '会津若松市 福島県',
  '鳥羽・伏見': '伏見区 京都市',
  新橋: '新橋駅 東京都港区',
  ヴァルミー: 'Valmy, France',
  ワーテルロー: 'Waterloo, Belgium',
  咸陽: '咸陽市 中国',
  平城京: '平城宮跡 奈良市',
  平安京: '京都市 京都府',
  出島: '出島 長崎市',
};

export function isMappablePlaceName(rawPlace: string): boolean {
  const trimmed = rawPlace.trim();
  if (!trimmed) return false;
  return !NON_MAPPABLE_EXACT.has(trimmed);
}

export function buildPlaceSearchQuery(rawPlace: string): string {
  const trimmed = rawPlace.trim();
  if (!trimmed) return '';
  return HISTORICAL_PLACE_QUERY_HINTS[trimmed] ?? trimmed;
}

export interface PlaceEventGroup {
  placeName: string;
  events: HistoricalEvent[];
  maxImportance: ImportanceLevel;
  assignedColorIds: AssignedColorId[];
}

export function collectPlaceEventGroups(
  events: HistoricalEvent[],
  eventColors: EventColorsMap
): {
  mappableGroups: PlaceEventGroup[];
  nonMappableEvents: HistoricalEvent[];
  allMappablePlaceNames: string[];
} {
  const groupLookup: Record<string, PlaceEventGroup> = {};
  const orderedPlaceNames: string[] = [];
  const nonMappableEvents: HistoricalEvent[] = [];

  for (const ev of events) {
    const mappablePlaces = Array.from(
      new Set(ev.places.map((p) => p.trim()).filter(isMappablePlaceName))
    );

    if (mappablePlaces.length === 0) {
      nonMappableEvents.push(ev);
      continue;
    }

    const evColor = eventColors[ev.id];
    for (const placeName of mappablePlaces) {
      let group = groupLookup[placeName];
      if (!group) {
        group = {
          placeName,
          events: [],
          maxImportance: ev.importance,
          assignedColorIds: [],
        };
        groupLookup[placeName] = group;
        orderedPlaceNames.push(placeName);
      }

      group.events.push(ev);
      if (ev.importance > group.maxImportance) {
        group.maxImportance = ev.importance;
      }
      if (evColor && !group.assignedColorIds.includes(evColor)) {
        group.assignedColorIds.push(evColor);
      }
    }
  }

  const mappableGroups = orderedPlaceNames
    .map((name) => groupLookup[name])
    .sort((a, b) => {
      if (b.events.length !== a.events.length) {
        return b.events.length - a.events.length;
      }
      return a.placeName.localeCompare(b.placeName, 'ja');
    });

  return {
    mappableGroups,
    nonMappableEvents,
    allMappablePlaceNames: orderedPlaceNames,
  };
}

export interface PinAppearance {
  background: string;
  borderColor: string;
  glyphColor: string;
  scale: number;
  isSelected: boolean;
}

export function getPlacePinAppearance(params: {
  group: PlaceEventGroup;
  selectedEventId: string | null;
  eventColors: EventColorsMap;
}): PinAppearance {
  const { group, selectedEventId, eventColors } = params;
  const selectedMatch = selectedEventId
    ? group.events.find((e) => e.id === selectedEventId)
    : undefined;
  const isSelected = Boolean(selectedMatch);

  const colorId =
    (selectedMatch ? eventColors[selectedMatch.id] : undefined) ??
    group.assignedColorIds[0];
  const colorDef = colorId
    ? COLOR_PALETTE.find((c) => c.id === colorId)
    : undefined;

  if (isSelected) {
    return {
      background: colorDef ? colorDef.swatchHex : '#9A3412',
      borderColor: '#1C1917',
      glyphColor: '#FBF9F5',
      scale: 1.32,
      isSelected: true,
    };
  }

  if (colorDef) {
    return {
      background: colorDef.swatchHex,
      borderColor: '#FFFFFF',
      glyphColor: '#FFFFFF',
      scale: 1.0,
      isSelected: false,
    };
  }

  if (group.maxImportance === 3) {
    return {
      background: '#44403C',
      borderColor: '#1C1917',
      glyphColor: '#FBF9F5',
      scale: 1.0,
      isSelected: false,
    };
  }

  return {
    background: '#78716C',
    borderColor: '#44403C',
    glyphColor: '#FBF9F5',
    scale: 0.9,
    isSelected: false,
  };
}
