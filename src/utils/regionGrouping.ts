import type { HistoricalEvent } from '../types/timeline';
import {
  findConnectedEvents,
  groupEventsByPlace,
  parseHistoricalDate,
} from './timelineParser';

export type PlaceGranularity = 'macro' | 'exact';

interface MacroRegionRule {
  region: string;
  keywords: string[];
}

const MACRO_REGION_RULES: MacroRegionRule[] = [
  // Japan - Regions
  {
    region: '関東（江戸・東京・開港地）',
    keywords: [
      '江戸',
      '東京',
      '浦賀',
      '江戸湾',
      '横浜',
      '神奈川',
      '下田',
      '新橋',
      '品川',
      '鎌倉',
      '水戸',
      '小田原',
      '関東',
      '武蔵',
      '相模',
      '千葉',
      '群馬',
      '埼玉',
    ],
  },
  {
    region: '近畿（京都・大坂・兵庫）',
    keywords: [
      '京都',
      '鳥羽・伏見',
      '鳥羽',
      '伏見',
      '大阪',
      '大坂',
      '兵庫',
      '神戸',
      '奈良',
      '平城京',
      '平安京',
      '堺',
      '比叡山',
      '近畿',
      '関西',
      '畿内',
      '滋賀',
      '大津',
    ],
  },
  {
    region: '西日本・九州（薩摩・長州・長崎）',
    keywords: [
      '薩摩',
      '鹿児島',
      '長州',
      '萩',
      '下関',
      '長崎',
      '出島',
      '平戸',
      '佐賀',
      '肥前',
      '土佐',
      '高知',
      '熊本',
      '福岡',
      '博多',
      '九州',
      '中国地方',
      '四国',
      '広島',
      '岡山',
    ],
  },
  {
    region: '東北・北日本（会津・箱館・新潟）',
    keywords: [
      '会津',
      '箱館',
      '函館',
      '五稜郭',
      '新潟',
      '仙台',
      '東北',
      '蝦夷',
      '北海道',
      '北陸',
      '金沢',
      '越後',
      '奥羽',
      '秋田',
      '盛岡',
      '青森',
    ],
  },
  {
    region: '中部・東海',
    keywords: ['名古屋', '尾張', '三河', '駿府', '静岡', '甲斐', '信濃', '岐阜', '中部', '東海'],
  },
  {
    region: '日本全国・各地',
    keywords: ['全国', '日本各地', '日本全国', '日本'],
  },
  // World - Regions
  {
    region: 'フランス',
    keywords: ['パリ', 'ヴェルサイユ', 'ヴァルミー', 'リヨン', 'マルセイユ', 'ナント', 'フランス', 'ヴァンデ'],
  },
  {
    region: '中央・西ヨーロッパ',
    keywords: [
      'ウィーン',
      'ベルリン',
      'マインツ',
      'ヴィッテンベルク',
      'ワーテルロー',
      'プロイセン',
      'オーストリア',
      'ドイツ',
      'オランダ',
      'ベルギー',
      'スイス',
      'ジュネーヴ',
      '神聖ローマ',
    ],
  },
  {
    region: '南欧・地中海世界',
    keywords: [
      'ローマ',
      'フィレンツェ',
      'ヴェネツィア',
      'ミラノ',
      'ナポリ',
      'イタリア',
      'アテネ',
      'スパルタ',
      'ギリシア',
      'マドリード',
      'スペイン',
      'ポルトガル',
      'リスボン',
      'コンスタンティノープル',
      'イスタンブール',
    ],
  },
  {
    region: 'イギリス',
    keywords: ['ロンドン', 'マンチェスター', 'リヴァプール', 'イギリス', 'イングランド', 'スコットランド'],
  },
  {
    region: 'ロシア・東欧',
    keywords: ['モスクワ', 'サンクトペテルブルク', 'ペトログラード', 'ロシア', 'ソ連', 'ワルシャワ', 'ポーランド'],
  },
  {
    region: '東アジア（中国・朝鮮）',
    keywords: ['咸陽', '長安', '洛陽', '北京', '南京', '上海', '広州', '中国', '清', '朝鮮', '漢城', 'ソウル'],
  },
  {
    region: 'アメリカ大陸',
    keywords: ['アメリカ', 'ワシントン', 'ニューヨーク', 'ボストン', 'フィラデルフィア'],
  },
];

export function resolveMacroRegion(rawPlace: string): string {
  const place = rawPlace.trim();
  if (!place || place === '不明' || place === '場所不明') {
    return '場所不明';
  }
  for (const rule of MACRO_REGION_RULES) {
    if (rule.keywords.some((kw) => place.includes(kw))) {
      return rule.region;
    }
  }
  return place;
}

export interface RegionGroup {
  region: string;
  subPlaces: string[];
  events: HistoricalEvent[];
}

export function groupEventsByRegion(
  events: HistoricalEvent[],
  granularity: PlaceGranularity = 'macro'
): RegionGroup[] {
  if (granularity === 'exact') {
    return groupEventsByPlace(events).map((g) => ({
      region: g.place,
      subPlaces: g.place === '場所不明' ? [] : [g.place],
      events: g.events,
    }));
  }

  const buckets = new Map<
    string,
    { subPlaces: Set<string>; events: HistoricalEvent[] }
  >();

  for (const ev of events) {
    const rawPlaces =
      ev.places.length > 0
        ? ev.places.filter((p) => p.trim() !== '')
        : ['場所不明'];
    const normalized = rawPlaces.length > 0 ? rawPlaces : ['場所不明'];

    for (const rawPlace of normalized) {
      const cleanPlace = rawPlace === '不明' ? '場所不明' : rawPlace.trim();
      const regionName = resolveMacroRegion(cleanPlace);
      const entry = buckets.get(regionName) ?? {
        subPlaces: new Set<string>(),
        events: [],
      };
      if (cleanPlace !== '場所不明') {
        entry.subPlaces.add(cleanPlace);
      }
      if (!entry.events.some((existing) => existing.id === ev.id)) {
        entry.events.push(ev);
      }
      buckets.set(regionName, entry);
    }
  }

  let groups: RegionGroup[] = Array.from(buckets.entries())
    .sort(([regionA, dataA], [regionB, dataB]) => {
      if (regionA === '場所不明') return 1;
      if (regionB === '場所不明') return -1;
      if (dataB.events.length !== dataA.events.length) {
        return dataB.events.length - dataA.events.length;
      }
      return regionA.localeCompare(regionB, 'ja');
    })
    .map(([region, data]) => ({
      region,
      subPlaces: Array.from(data.subPlaces),
      events: data.events,
    }));

  // If custom dataset has many unmapped single-event places (> 7 regions), consolidate tail into "その他の地域"
  if (groups.length > 7) {
    const unknownGroup = groups.find((g) => g.region === '場所不明');
    const namedGroups = groups.filter((g) => g.region !== '場所不明');
    const primary = namedGroups.slice(0, 5);
    const overflow = namedGroups.slice(5);

    if (overflow.length > 1) {
      const mergedEventsMap = new Map<string, HistoricalEvent>();
      const mergedSubPlaces = new Set<string>();
      for (const item of overflow) {
        for (const sp of item.subPlaces) mergedSubPlaces.add(sp);
        for (const ev of item.events) mergedEventsMap.set(ev.id, ev);
      }
      const mergedEvents = Array.from(mergedEventsMap.values()).sort((a, b) => {
        const pa = parseHistoricalDate(a.date, a.date_precision);
        const pb = parseHistoricalDate(b.date, b.date_precision);
        return pa.sortValue - pb.sortValue;
      });
      primary.push({
        region: 'その他の地域',
        subPlaces: Array.from(mergedSubPlaces),
        events: mergedEvents,
      });
      groups = unknownGroup ? [...primary, unknownGroup] : primary;
    }
  }

  return groups;
}

export interface CrossRegionCausalLink {
  fromEvent: HistoricalEvent;
  toEvent: HistoricalEvent;
  fromRegion: string;
  toRegion: string;
}

export interface RegionLink {
  id: string;
  regionA: string;
  regionB: string;
  sharedEvents: HistoricalEvent[];
  causalLinks: CrossRegionCausalLink[];
  totalStrength: number;
}

export function getEventRegions(
  ev: HistoricalEvent,
  granularity: PlaceGranularity,
  activeRegionSet?: Set<string>
): string[] {
  const rawPlaces =
    ev.places.length > 0
      ? ev.places.filter((p) => p.trim() !== '')
      : ['場所不明'];
  const normalized = rawPlaces.length > 0 ? rawPlaces : ['場所不明'];

  const regions = new Set<string>();
  for (const p of normalized) {
    const clean = p === '不明' ? '場所不明' : p.trim();
    const resolved =
      granularity === 'macro' ? resolveMacroRegion(clean) : clean;
    if (activeRegionSet && !activeRegionSet.has(resolved)) {
      if (activeRegionSet.has('その他の地域')) {
        regions.add('その他の地域');
      }
    } else {
      regions.add(resolved);
    }
  }
  return Array.from(regions);
}

export function computeRegionRelationships(
  events: HistoricalEvent[],
  regionGroups: RegionGroup[],
  granularity: PlaceGranularity = 'macro'
): RegionLink[] {
  const activeRegionSet = new Set(regionGroups.map((g) => g.region));
  const eventRegionsMap = new Map<string, string[]>();
  for (const ev of events) {
    eventRegionsMap.set(ev.id, getEventRegions(ev, granularity, activeRegionSet));
  }

  const pairMap = new Map<
    string,
    {
      regionA: string;
      regionB: string;
      sharedEvents: Map<string, HistoricalEvent>;
      causalLinks: Map<string, CrossRegionCausalLink>;
    }
  >();

  const ensurePair = (r1: string, r2: string) => {
    const [a, b] = r1.localeCompare(r2, 'ja') <= 0 ? [r1, r2] : [r2, r1];
    const key = `${a}|||${b}`;
    let entry = pairMap.get(key);
    if (!entry) {
      entry = {
        regionA: a,
        regionB: b,
        sharedEvents: new Map(),
        causalLinks: new Map(),
      };
      pairMap.set(key, entry);
    }
    return entry;
  };

  // 1. Events that span multiple regions
  for (const ev of events) {
    const regions = eventRegionsMap.get(ev.id) ?? [];
    if (regions.length < 2) continue;
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        if (regions[i] === '場所不明' || regions[j] === '場所不明') continue;
        const pair = ensurePair(regions[i], regions[j]);
        pair.sharedEvents.set(ev.id, ev);
      }
    }
  }

  // 2. Explicit related_events bridging different regions (ordered chronologically where possible)
  const byId = new Map(events.map((e) => [e.id, e]));
  for (const ev of events) {
    const fromRegions = eventRegionsMap.get(ev.id) ?? [];
    for (const targetId of ev.related_events) {
      const target = byId.get(targetId);
      if (!target || target.id === ev.id) continue;
      const toRegions = eventRegionsMap.get(target.id) ?? [];

      const evDate = parseHistoricalDate(ev.date, ev.date_precision).sortValue;
      const targetDate = parseHistoricalDate(
        target.date,
        target.date_precision
      ).sortValue;
      const isChronoForward = evDate <= targetDate;
      const earlier = isChronoForward ? ev : target;
      const later = isChronoForward ? target : ev;
      const earlierRegions = isChronoForward ? fromRegions : toRegions;
      const laterRegions = isChronoForward ? toRegions : fromRegions;

      for (const r1 of earlierRegions) {
        for (const r2 of laterRegions) {
          if (r1 === r2 || r1 === '場所不明' || r2 === '場所不明') continue;
          const pair = ensurePair(r1, r2);
          const linkKey = `${earlier.id}->${later.id}:${r1}->${r2}`;
          if (!pair.causalLinks.has(linkKey)) {
            pair.causalLinks.set(linkKey, {
              fromEvent: earlier,
              toEvent: later,
              fromRegion: r1,
              toRegion: r2,
            });
          }
        }
      }
    }
  }

  return Array.from(pairMap.entries())
    .map(([id, data]) => {
      const sharedEvents = Array.from(data.sharedEvents.values());
      const causalLinks = Array.from(data.causalLinks.values());
      return {
        id,
        regionA: data.regionA,
        regionB: data.regionB,
        sharedEvents,
        causalLinks,
        totalStrength: sharedEvents.length + causalLinks.length,
      };
    })
    .filter((link) => link.totalStrength > 0)
    .sort((a, b) => b.totalStrength - a.totalStrength);
}

export function findRelatedEventIdsForHighlight(
  selectedEvent: HistoricalEvent | null,
  allEvents: HistoricalEvent[]
): Set<string> {
  if (!selectedEvent) return new Set();
  const { explicitRelated, reverseRelated } = findConnectedEvents(
    selectedEvent,
    allEvents
  );
  return new Set([
    ...explicitRelated.map((e) => e.id),
    ...reverseRelated.map((e) => e.id),
  ]);
}

export interface EventYearBucket {
  key: string;
  label: string;
  sortValue: number;
}

export function getEventYearBucket(ev: HistoricalEvent): EventYearBucket {
  const parsed = parseHistoricalDate(ev.date, ev.date_precision);
  if (parsed.isUnknown) {
    return {
      key: 'unknown',
      label: '年代不明',
      sortValue: Number.POSITIVE_INFINITY,
    };
  }

  const raw = (ev.date ?? '').trim();
  if (
    ev.date_precision === 'century' ||
    ev.date_precision === 'period' ||
    raw.includes('世紀') ||
    raw.includes('年代') ||
    parsed.yearApprox === null
  ) {
    return {
      key: `era:${parsed.eraLabel}`,
      label: parsed.eraLabel,
      sortValue: parsed.sortValue,
    };
  }

  const year = parsed.yearApprox;
  const label = year < 0 ? `紀元前${Math.abs(year)}年` : `${year}年`;
  return {
    key: `year:${year}`,
    label,
    sortValue: year,
  };
}

export function formatSubDateInYearRow(
  ev: HistoricalEvent,
  rowLabel: string
): string | null {
  const raw = (ev.date ?? '').trim();
  if (!raw || raw === '不明' || raw === rowLabel) return null;

  const ymd = raw.match(/^\s*-?\d{1,5}\s*[-/年.]\s*(\d{1,2})(?:\s*[-/月.]\s*(\d{1,2}))?/);
  if (ymd) {
    const month = Number.parseInt(ymd[1], 10);
    const day = ymd[2] ? Number.parseInt(ymd[2], 10) : null;
    return day ? `${month}月${day}日` : `${month}月`;
  }

  if (/^-?\d{1,5}$/.test(raw) && `${raw}年` === rowLabel) {
    return null;
  }

  return raw;
}

export interface MatrixSingleItem {
  event: HistoricalEvent;
  hiddenRegions: string[];
}

export interface MatrixSpanItem {
  event: HistoricalEvent;
  minCol: number;
  maxCol: number;
  regionIndices: number[];
  activeRegions: string[];
  hiddenRegions: string[];
}

export type MatrixYearBand =
  | {
      type: 'single';
      singleByRegion: Map<string, MatrixSingleItem[]>;
    }
  | {
      type: 'span';
      spanItem: MatrixSpanItem;
    };

export interface MatrixYearRow {
  key: string;
  label: string;
  bands: MatrixYearBand[];
  totalEventsInRow: number;
}

export function buildRegionMatrixRows(
  events: HistoricalEvent[],
  visibleRegions: string[],
  granularity: PlaceGranularity = 'macro',
  allRegionSet?: Set<string>
): MatrixYearRow[] {
  const regionIndexMap = new Map<string, number>();
  visibleRegions.forEach((r, idx) => regionIndexMap.set(r, idx));

  const rows: MatrixYearRow[] = [];
  const rowByKey = new Map<string, MatrixYearRow>();

  for (const ev of events) {
    const allEvRegions = getEventRegions(ev, granularity, allRegionSet);
    const matchedRegions = allEvRegions.filter((r) => regionIndexMap.has(r));
    if (matchedRegions.length === 0) continue;

    const hiddenRegions = allEvRegions.filter((r) => !regionIndexMap.has(r));
    const bucket = getEventYearBucket(ev);
    let row = rowByKey.get(bucket.key);
    if (!row) {
      row = {
        key: bucket.key,
        label: bucket.label,
        bands: [],
        totalEventsInRow: 0,
      };
      rowByKey.set(bucket.key, row);
      rows.push(row);
    }

    row.totalEventsInRow += 1;

    if (matchedRegions.length === 1) {
      const targetRegion = matchedRegions[0];
      const lastBand = row.bands[row.bands.length - 1];
      let singleBand: Extract<MatrixYearBand, { type: 'single' }>;
      if (lastBand && lastBand.type === 'single') {
        singleBand = lastBand;
      } else {
        singleBand = {
          type: 'single',
          singleByRegion: new Map<string, MatrixSingleItem[]>(),
        };
        row.bands.push(singleBand);
      }
      const existing = singleBand.singleByRegion.get(targetRegion) ?? [];
      existing.push({ event: ev, hiddenRegions });
      singleBand.singleByRegion.set(targetRegion, existing);
    } else {
      const indices = matchedRegions
        .map((r) => regionIndexMap.get(r)!)
        .sort((a, b) => a - b);
      const minCol = indices[0];
      const maxCol = indices[indices.length - 1];
      const orderedRegions = indices.map((idx) => visibleRegions[idx]);

      row.bands.push({
        type: 'span',
        spanItem: {
          event: ev,
          minCol,
          maxCol,
          regionIndices: indices,
          activeRegions: orderedRegions,
          hiddenRegions,
        },
      });
    }
  }

  return rows;
}


