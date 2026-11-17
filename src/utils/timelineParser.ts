import {
  COLOR_PALETTE,
  type AssignedColorId,
  type Certainty,
  type ColorLabelsMap,
  type DatePrecision,
  type EventCategory,
  type EventColorsMap,
  type HistoricalDatabase,
  type HistoricalEvent,
  type ImportanceLevel,
  type SortOrder,
  type TimelineFilters,
} from '../types/timeline';

const VALID_PRECISIONS = new Set<DatePrecision>([
  'year',
  'month',
  'day',
  'century',
  'period',
  'unknown',
]);

const VALID_CATEGORIES = new Set<EventCategory>([
  'politics',
  'diplomacy',
  'economy',
  'military',
  'society',
  'culture',
  'religion',
  'science',
]);

const VALID_CERTAINTY = new Set<Certainty>(['explicit', 'inferred']);

const JAPANESE_ERA_BASE_YEARS: Array<{ keywords: string[]; startYear: number }> = [
  { keywords: ['旧石器'], startYear: -30000 },
  { keywords: ['縄文'], startYear: -14000 },
  { keywords: ['弥生'], startYear: -300 },
  { keywords: ['古墳'], startYear: 250 },
  { keywords: ['飛鳥'], startYear: 592 },
  { keywords: ['奈良'], startYear: 710 },
  { keywords: ['平安'], startYear: 794 },
  { keywords: ['鎌倉'], startYear: 1185 },
  { keywords: ['南北朝'], startYear: 1336 },
  { keywords: ['室町'], startYear: 1336 },
  { keywords: ['戦国'], startYear: 1467 },
  { keywords: ['安土桃山'], startYear: 1573 },
  { keywords: ['江戸', '幕末'], startYear: 1603 },
  { keywords: ['明治'], startYear: 1868 },
  { keywords: ['大正'], startYear: 1912 },
  { keywords: ['昭和'], startYear: 1926 },
  { keywords: ['平成'], startYear: 1989 },
  { keywords: ['令和'], startYear: 2019 },
  { keywords: ['ルネサンス'], startYear: 1350 },
  { keywords: ['大航海時代'], startYear: 1450 },
  { keywords: ['産業革命'], startYear: 1760 },
  { keywords: ['冷戦'], startYear: 1947 },
];

export interface ParsedDateInfo {
  sortValue: number;
  isUnknown: boolean;
  yearApprox: number | null;
  eraLabel: string;
}

export function parseHistoricalDate(
  dateStr: string,
  precision: DatePrecision
): ParsedDateInfo {
  const raw = (dateStr ?? '').trim();
  if (
    !raw ||
    precision === 'unknown' ||
    raw === '不明' ||
    raw.toLowerCase() === 'unknown'
  ) {
    return {
      sortValue: Number.POSITIVE_INFINITY,
      isUnknown: true,
      yearApprox: null,
      eraLabel: '年代不明',
    };
  }

  const isBce =
    /紀元前|BC|B\.C\.|BCE/i.test(raw) || raw.startsWith('-');

  const centuryMatch = raw.match(
    /(\d+)\s*(?:世紀|th\s*century|st\s*century|nd\s*century|rd\s*century)/i
  );
  if (
    centuryMatch &&
    (precision === 'century' || raw.includes('世紀') || /century/i.test(raw))
  ) {
    const centuryNum = Number.parseInt(centuryMatch[1], 10);
    const approxYear = isBce
      ? -(centuryNum * 100 - 50)
      : (centuryNum - 1) * 100 + 50;
    const decadeOffset = raw.includes('前半')
      ? -25
      : raw.includes('後半')
        ? 25
        : 0;
    const year = approxYear + decadeOffset;
    return {
      sortValue: year * 10000,
      isUnknown: false,
      yearApprox: year,
      eraLabel: isBce ? `紀元前${centuryNum}世紀` : `${centuryNum}世紀`,
    };
  }

  const cleaned = raw.replace(/紀元前|BC|B\.C\.|BCE/gi, '').trim();
  const ymdMatch = cleaned.match(
    /^(-?\d{1,5})\s*[-/年.]\s*(\d{1,2})(?:\s*[-/月.]\s*(\d{1,2}))?/
  );
  if (ymdMatch) {
    let year = Number.parseInt(ymdMatch[1], 10);
    if (isBce && year > 0) year = -year;
    const month = Math.min(12, Math.max(1, Number.parseInt(ymdMatch[2], 10)));
    const day = ymdMatch[3]
      ? Math.min(31, Math.max(1, Number.parseInt(ymdMatch[3], 10)))
      : 0;
    return {
      sortValue: year * 10000 + month * 100 + day,
      isUnknown: false,
      yearApprox: year,
      eraLabel: formatEraLabel(year),
    };
  }

  const yearMatch = cleaned.match(/(-?\d{1,5})/);
  if (yearMatch) {
    let year = Number.parseInt(yearMatch[1], 10);
    if (isBce && year > 0) year = -year;
    const decadeBump = raw.includes('年代') ? 5 : 0;
    return {
      sortValue: (year + decadeBump) * 10000,
      isUnknown: false,
      yearApprox: year,
      eraLabel: formatEraLabel(year),
    };
  }

  for (const era of JAPANESE_ERA_BASE_YEARS) {
    if (era.keywords.some((kw) => raw.includes(kw))) {
      return {
        sortValue: era.startYear * 10000,
        isUnknown: false,
        yearApprox: era.startYear,
        eraLabel: raw,
      };
    }
  }

  return {
    sortValue: Number.POSITIVE_INFINITY - 1,
    isUnknown: false,
    yearApprox: null,
    eraLabel: raw,
  };
}

export function formatEraLabel(year: number): string {
  if (year < 0) {
    const century = Math.floor((Math.abs(year) - 1) / 100) + 1;
    return `紀元前${century}世紀`;
  }
  if (year < 1500) {
    const century = Math.floor((year - 1) / 100) + 1;
    return `${century}世紀`;
  }
  const decade = Math.floor(year / 10) * 10;
  return `${decade}年代`;
}

export interface ParseResult {
  ok: boolean;
  data?: HistoricalDatabase;
  errors: string[];
  warnings: string[];
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function parseHistoricalJson(rawInput: string): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, errors: ['JSONデータが入力されていません。'], warnings };
  }

  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    trimmed = fenceMatch[1].trim();
    warnings.push('Markdownコードブロック記法（```）を自動で除去して読み込みました。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const message = err instanceof Error ? err.message : '構文エラー';
    return {
      ok: false,
      errors: [`JSONの構文が正しくありません: ${message}`],
      warnings,
    };
  }

  let rawEvents: unknown[];
  if (Array.isArray(parsed)) {
    rawEvents = parsed;
    warnings.push('トップレベル配列形式を { "events": [...] } として読み込みました。');
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Record<string, unknown>).events)
  ) {
    rawEvents = (parsed as { events: unknown[] }).events;
  } else {
    return {
      ok: false,
      errors: ['ルートオブジェクトに "events" 配列が見つかりません。'],
      warnings,
    };
  }

  if (rawEvents.length === 0) {
    return {
      ok: false,
      errors: ['"events" 配列が空です。1件以上の出来事が必要です。'],
      warnings,
    };
  }

  const seenIds = new Set<string>();
  const normalizedEvents: HistoricalEvent[] = [];

  rawEvents.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      errors.push(`${idx + 1}件目のレコードがオブジェクトではありません。`);
      return;
    }

    const rec = item as Record<string, unknown>;
    const rawId =
      typeof rec.id === 'string' && rec.id.trim()
        ? rec.id.trim()
        : `E${String(idx + 1).padStart(3, '0')}`;
    if (!rec.id) {
      warnings.push(`${idx + 1}件目に id がないため "${rawId}" を自動付与しました。`);
    }
    if (seenIds.has(rawId)) {
      warnings.push(`ID "${rawId}" が重複しています。`);
    }
    seenIds.add(rawId);

    const title = typeof rec.title === 'string' ? rec.title.trim() : '';
    if (!title) {
      errors.push(`ID "${rawId}": "title"（出来事の名称）が空です。`);
      return;
    }

    const date =
      rec.date !== undefined && rec.date !== null
        ? String(rec.date).trim()
        : '不明';
    const rawPrecision =
      typeof rec.date_precision === 'string'
        ? rec.date_precision.trim()
        : 'year';
    const date_precision: DatePrecision = VALID_PRECISIONS.has(
      rawPrecision as DatePrecision
    )
      ? (rawPrecision as DatePrecision)
      : date === '不明'
        ? 'unknown'
        : 'year';

    const rawCategories = asStringArray(rec.category);
    const categories: EventCategory[] = rawCategories.filter(
      (cat): cat is EventCategory => VALID_CATEGORIES.has(cat as EventCategory)
    );
    if (categories.length === 0) {
      categories.push('politics');
      if (rawCategories.length > 0) {
        warnings.push(
          `ID "${rawId}": 未定義のカテゴリ (${rawCategories.join(', ')}) を「政治」として扱いました。`
        );
      }
    }

    const rawImportance = Number(rec.importance);
    const importance: ImportanceLevel =
      rawImportance === 3 ? 3 : rawImportance === 1 ? 1 : 2;

    const rawCertainty =
      typeof rec.certainty === 'string' ? rec.certainty.trim() : 'explicit';
    const certainty: Certainty = VALID_CERTAINTY.has(rawCertainty as Certainty)
      ? (rawCertainty as Certainty)
      : 'explicit';

    normalizedEvents.push({
      id: rawId,
      date,
      date_precision,
      title,
      description:
        typeof rec.description === 'string' ? rec.description.trim() : '',
      people: asStringArray(rec.people),
      places: asStringArray(rec.places),
      category: categories,
      causes: asStringArray(rec.causes),
      consequences: asStringArray(rec.consequences),
      related_events: asStringArray(rec.related_events),
      importance,
      source: typeof rec.source === 'string' ? rec.source.trim() : '',
      certainty,
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    data: { events: normalizedEvents },
    errors,
    warnings,
  };
}

export function sortEventsChronologically(
  events: HistoricalEvent[],
  order: SortOrder = 'asc'
): HistoricalEvent[] {
  return [...events].sort((a, b) => {
    const pa = parseHistoricalDate(a.date, a.date_precision);
    const pb = parseHistoricalDate(b.date, b.date_precision);

    if (pa.isUnknown && pb.isUnknown) {
      return a.id.localeCompare(b.id);
    }
    if (pa.isUnknown) return 1;
    if (pb.isUnknown) return -1;

    if (pa.sortValue !== pb.sortValue) {
      return order === 'asc'
        ? pa.sortValue - pb.sortValue
        : pb.sortValue - pa.sortValue;
    }

    if (b.importance !== a.importance) {
      return b.importance - a.importance;
    }
    return a.id.localeCompare(b.id);
  });
}

export function filterEvents(
  events: HistoricalEvent[],
  filters: TimelineFilters,
  eventColors: EventColorsMap = {}
): HistoricalEvent[] {
  const query = filters.search.trim().toLowerCase();

  const matched = events.filter((ev) => {
    if (filters.category !== 'all' && !ev.category.includes(filters.category)) {
      return false;
    }
    if (filters.importance !== 'all' && ev.importance !== filters.importance) {
      return false;
    }
    if (filters.certainty !== 'all' && ev.certainty !== filters.certainty) {
      return false;
    }
    if (filters.place !== 'all' && !ev.places.includes(filters.place)) {
      return false;
    }
    if (filters.color !== 'all') {
      const assigned = eventColors[ev.id] ?? 'none';
      if (assigned !== filters.color) {
        return false;
      }
    }
    if (!query) return true;

    const haystack = [
      ev.id,
      ev.date,
      ev.title,
      ev.description,
      ev.source,
      ...ev.people,
      ...ev.places,
      ...ev.causes,
      ...ev.consequences,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  return sortEventsChronologically(matched, filters.sortOrder);
}

export interface EraGroup {
  eraLabel: string;
  events: HistoricalEvent[];
}

export function groupEventsByEra(events: HistoricalEvent[]): EraGroup[] {
  const groups: EraGroup[] = [];
  const labelIndex = new Map<string, number>();

  for (const ev of events) {
    const parsed = parseHistoricalDate(ev.date, ev.date_precision);
    const key = parsed.eraLabel;
    const existingIdx = labelIndex.get(key);
    if (existingIdx !== undefined) {
      groups[existingIdx].events.push(ev);
    } else {
      labelIndex.set(key, groups.length);
      groups.push({ eraLabel: key, events: [ev] });
    }
  }

  return groups;
}

export interface PlaceGroup {
  place: string;
  events: HistoricalEvent[];
}

/**
 * Groups events by each place in `ev.places` (preserving chronological order within each lane).
 * Places are ordered by event count descending, then alphabetically, with "場所不明" at the end.
 */
export function groupEventsByPlace(events: HistoricalEvent[]): PlaceGroup[] {
  const buckets = new Map<string, HistoricalEvent[]>();

  for (const ev of events) {
    const places =
      ev.places.length > 0
        ? ev.places.filter((p) => p.trim() !== '')
        : ['場所不明'];
    const normalized = places.length > 0 ? places : ['場所不明'];

    for (const p of normalized) {
      const key = p === '不明' ? '場所不明' : p;
      const list = buckets.get(key) ?? [];
      if (!list.some((existing) => existing.id === ev.id)) {
        list.push(ev);
      }
      buckets.set(key, list);
    }
  }

  return Array.from(buckets.entries())
    .sort(([placeA, listA], [placeB, listB]) => {
      if (placeA === '場所不明') return 1;
      if (placeB === '場所不明') return -1;
      if (listB.length !== listA.length) {
        return listB.length - listA.length;
      }
      return placeA.localeCompare(placeB, 'ja');
    })
    .map(([place, list]) => ({ place, events: list }));
}

export interface ColorGroup {
  colorId: AssignedColorId | 'none';
  label: string;
  swatchHex: string | null;
  events: HistoricalEvent[];
}

export function groupEventsByColor(
  events: HistoricalEvent[],
  eventColors: EventColorsMap,
  colorLabels: ColorLabelsMap
): ColorGroup[] {
  const buckets = new Map<AssignedColorId | 'none', HistoricalEvent[]>();
  for (const ev of events) {
    const colorId = eventColors[ev.id] ?? 'none';
    const list = buckets.get(colorId) ?? [];
    list.push(ev);
    buckets.set(colorId, list);
  }

  const groups: ColorGroup[] = [];
  for (const def of COLOR_PALETTE) {
    const list = buckets.get(def.id);
    if (list && list.length > 0) {
      groups.push({
        colorId: def.id,
        label: colorLabels[def.id] || def.defaultLabel,
        swatchHex: def.swatchHex,
        events: list,
      });
    }
  }

  const unassigned = buckets.get('none');
  if (unassigned && unassigned.length > 0) {
    groups.push({
      colorId: 'none',
      label: '未分類（色なし）',
      swatchHex: null,
      events: unassigned,
    });
  }

  return groups;
}

export interface PersonSummary {
  name: string;
  events: HistoricalEvent[];
  places: string[];
  firstDate: string;
  lastDate: string;
}

export function extractPeopleDirectory(
  events: HistoricalEvent[]
): PersonSummary[] {
  const sorted = sortEventsChronologically(events, 'asc');
  const byName = new Map<string, HistoricalEvent[]>();

  for (const ev of sorted) {
    for (const person of ev.people) {
      const name = person.trim();
      if (!name || name === '不明') continue;
      const list = byName.get(name) ?? [];
      list.push(ev);
      byName.set(name, list);
    }
  }

  return Array.from(byName.entries())
    .sort(([a, listA], [b, listB]) => {
      if (listB.length !== listA.length) {
        return listB.length - listA.length;
      }
      return a.localeCompare(b, 'ja');
    })
    .map(([name, list]) => {
      const placeSet = new Set<string>();
      for (const ev of list) {
        for (const p of ev.places) {
          if (p && p !== '不明') placeSet.add(p);
        }
      }
      return {
        name,
        events: list,
        places: Array.from(placeSet),
        firstDate: list[0]?.date ?? '',
        lastDate: list[list.length - 1]?.date ?? '',
      };
    });
}

const CATEGORY_TO_COLOR: Record<EventCategory, AssignedColorId> = {
  politics: 'vermilion',
  diplomacy: 'lapis',
  economy: 'forest',
  society: 'forest',
  culture: 'amber',
  religion: 'amber',
  science: 'amber',
  military: 'plum',
};

export function autoAssignColorsByCategory(
  events: HistoricalEvent[]
): EventColorsMap {
  const map: EventColorsMap = {};
  for (const ev of events) {
    const primaryCat = ev.category[0];
    if (primaryCat) {
      map[ev.id] = CATEGORY_TO_COLOR[primaryCat] ?? 'slate';
    }
  }
  return map;
}

export function autoAssignColorsByImportance(
  events: HistoricalEvent[]
): EventColorsMap {
  const map: EventColorsMap = {};
  for (const ev of events) {
    if (ev.importance === 3) {
      map[ev.id] = 'vermilion';
    } else if (ev.importance === 2) {
      map[ev.id] = 'amber';
    } else {
      map[ev.id] = 'slate';
    }
  }
  return map;
}

export interface ColorCountsSummary {
  total: number;
  assignedTotal: number;
  none: number;
  byColor: Record<AssignedColorId, number>;
}

export function countEventsByColor(
  events: HistoricalEvent[],
  eventColors: EventColorsMap
): ColorCountsSummary {
  const byColor: Record<AssignedColorId, number> = {
    vermilion: 0,
    lapis: 0,
    forest: 0,
    amber: 0,
    plum: 0,
    slate: 0,
  };
  let none = 0;
  let assignedTotal = 0;

  for (const ev of events) {
    const colorId = eventColors[ev.id];
    if (colorId && colorId in byColor) {
      byColor[colorId] += 1;
      assignedTotal += 1;
    } else {
      none += 1;
    }
  }

  return {
    total: events.length,
    assignedTotal,
    none,
    byColor,
  };
}

export function mergeHistoricalDatabases(
  base: HistoricalDatabase,
  incoming: HistoricalDatabase
): HistoricalDatabase {
  const byId = new Map<string, HistoricalEvent>();
  for (const ev of base.events) {
    byId.set(ev.id, ev);
  }
  for (const ev of incoming.events) {
    byId.set(ev.id, ev);
  }
  return { events: Array.from(byId.values()) };
}

export function findConnectedEvents(
  target: HistoricalEvent,
  allEvents: HistoricalEvent[]
): {
  explicitRelated: HistoricalEvent[];
  reverseRelated: HistoricalEvent[];
} {
  const byId = new Map(allEvents.map((e) => [e.id, e]));
  const explicitRelated = target.related_events
    .map((id) => byId.get(id))
    .filter((e): e is HistoricalEvent => e !== undefined && e.id !== target.id);

  const explicitIds = new Set(explicitRelated.map((e) => e.id));
  const reverseRelated = allEvents.filter(
    (e) =>
      e.id !== target.id &&
      !explicitIds.has(e.id) &&
      e.related_events.includes(target.id)
  );

  return { explicitRelated, reverseRelated };
}

export type EventFocusRelation =
  | 'none'
  | 'selected'
  | 'related-before'
  | 'related-after'
  | 'related'
  | 'unrelated';

export function getEventFocusRelation(
  ev: HistoricalEvent,
  selectedEvent: HistoricalEvent | null,
  relatedEventIds: ReadonlySet<string>
): EventFocusRelation {
  if (!selectedEvent) return 'none';
  if (ev.id === selectedEvent.id) return 'selected';
  if (!relatedEventIds.has(ev.id)) return 'unrelated';

  const evParsed = parseHistoricalDate(ev.date, ev.date_precision);
  const selParsed = parseHistoricalDate(
    selectedEvent.date,
    selectedEvent.date_precision
  );

  if (!evParsed.isUnknown && !selParsed.isUnknown) {
    if (evParsed.sortValue < selParsed.sortValue) return 'related-before';
    if (evParsed.sortValue > selParsed.sortValue) return 'related-after';
  }
  return 'related';
}

export function toggleSelectedEventId(
  currentSelectedId: string | null,
  targetEventId: string
): string | null {
  return currentSelectedId === targetEventId ? null : targetEventId;
}
