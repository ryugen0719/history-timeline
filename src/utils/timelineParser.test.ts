import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoAssignColorsByCategory,
  autoAssignColorsByImportance,
  countEventsByColor,
  extractPeopleDirectory,
  filterEvents,
  findConnectedEvents,
  getEventFocusRelation,
  groupEventsByColor,
  groupEventsByEra,
  groupEventsByPlace,
  mergeHistoricalDatabases,
  parseHistoricalDate,
  parseHistoricalJson,
  sortEventsChronologically,
  toggleSelectedEventId,
} from './timelineParser';
import {
  DEFAULT_COLOR_LABELS,
  type HistoricalEvent,
  type TimelineFilters,
} from '../types/timeline';

const BASE_FILTERS: TimelineFilters = {
  search: '',
  category: 'all',
  importance: 'all',
  certainty: 'all',
  place: 'all',
  color: 'all',
  sortOrder: 'asc',
};

test('parseHistoricalDate parses years, YMD dates, BCE, centuries, and unknown', () => {
  const y1853 = parseHistoricalDate('1853', 'year');
  const y1853Jul = parseHistoricalDate('1853-07-08', 'day');
  const jpDate = parseHistoricalDate('1868年3月14日', 'day');
  const bce = parseHistoricalDate('紀元前221年', 'year');
  const century = parseHistoricalDate('19世紀', 'century');
  const unknown = parseHistoricalDate('不明', 'unknown');

  assert.equal(y1853.yearApprox, 1853);
  assert.ok(y1853.sortValue < y1853Jul.sortValue);
  assert.equal(jpDate.sortValue, 18680314);
  assert.equal(bce.yearApprox, -221);
  assert.ok(bce.sortValue < 0);
  assert.equal(century.eraLabel, '19世紀');
  assert.equal(unknown.isUnknown, true);
  assert.equal(unknown.sortValue, Number.POSITIVE_INFINITY);
});

test('parseHistoricalJson validates schema and strips markdown code fences', () => {
  const fenced = `\`\`\`json
  {
    "events": [
      {
        "id": "E001",
        "date": "1853",
        "date_precision": "year",
        "title": "ペリー来航",
        "description": "アメリカのペリーが浦賀に来航した。",
        "people": ["マシュー・ペリー"],
        "places": ["浦賀"],
        "category": ["diplomacy"],
        "causes": [],
        "consequences": [],
        "related_events": [],
        "importance": 3,
        "source": "授業資料 p.1",
        "certainty": "explicit"
      }
    ]
  }
  \`\`\``;

  const result = parseHistoricalJson(fenced);
  assert.equal(result.ok, true);
  assert.equal(result.data?.events.length, 1);
  assert.equal(result.data?.events[0].title, 'ペリー来航');
  assert.ok(result.warnings.length >= 1);
});

test('parseHistoricalJson rejects malformed JSON and missing title', () => {
  const badSyntax = parseHistoricalJson('{ events: [ }');
  assert.equal(badSyntax.ok, false);
  assert.ok(badSyntax.errors[0].includes('構文'));

  const missingTitle = parseHistoricalJson(
    JSON.stringify({ events: [{ id: 'E001', date: '1853' }] })
  );
  assert.equal(missingTitle.ok, false);
  assert.ok(missingTitle.errors[0].includes('title'));
});

test('sortEventsChronologically orders events accurately with unknown last', () => {
  const events: HistoricalEvent[] = [
    {
      id: 'E3',
      date: '不明',
      date_precision: 'unknown',
      title: '時期不明の出来事',
      description: '',
      people: [],
      places: [],
      category: ['society'],
      causes: [],
      consequences: [],
      related_events: [],
      importance: 1,
      source: '',
      certainty: 'inferred',
    },
    {
      id: 'E2',
      date: '1868-03-14',
      date_precision: 'day',
      title: '五箇条の御誓文',
      description: '',
      people: [],
      places: ['京都'],
      category: ['politics'],
      causes: [],
      consequences: [],
      related_events: [],
      importance: 3,
      source: '',
      certainty: 'explicit',
    },
    {
      id: 'E1',
      date: '1853',
      date_precision: 'year',
      title: 'ペリー来航',
      description: '',
      people: ['ペリー'],
      places: ['浦賀'],
      category: ['diplomacy'],
      causes: [],
      consequences: [],
      related_events: [],
      importance: 3,
      source: '',
      certainty: 'explicit',
    },
  ];

  const asc = sortEventsChronologically(events, 'asc');
  assert.deepEqual(asc.map((e) => e.id), ['E1', 'E2', 'E3']);

  const desc = sortEventsChronologically(events, 'desc');
  assert.deepEqual(desc.map((e) => e.id), ['E2', 'E1', 'E3']);
});

test('filterEvents, groupEventsByEra, merge, and findConnectedEvents work end-to-end', () => {
  const sample: HistoricalEvent[] = [
    {
      id: 'E001',
      date: '1853',
      date_precision: 'year',
      title: 'ペリー来航',
      description: '浦賀に来航',
      people: ['マシュー・ペリー'],
      places: ['浦賀', '江戸湾'],
      category: ['diplomacy'],
      causes: ['欧米列強のアジア進出'],
      consequences: ['日米和親条約の締結'],
      related_events: ['E002'],
      importance: 3,
      source: 'p.1',
      certainty: 'explicit',
    },
    {
      id: 'E002',
      date: '1854',
      date_precision: 'year',
      title: '日米和親条約',
      description: '下田・箱館を開港',
      people: ['林復斎', 'マシュー・ペリー'],
      places: ['横浜', '浦賀'],
      category: ['diplomacy'],
      causes: ['ペリーの再航'],
      consequences: ['鎖国体制の終了'],
      related_events: [],
      importance: 3,
      source: 'p.2',
      certainty: 'explicit',
    },
    {
      id: 'E003',
      date: '1860',
      date_precision: 'year',
      title: '桜田門外の変',
      description: '井伊直弼が暗殺',
      people: ['井伊直弼'],
      places: ['江戸'],
      category: ['politics'],
      causes: ['安政の大獄'],
      consequences: ['幕府権威の失墜'],
      related_events: [],
      importance: 2,
      source: 'p.4',
      certainty: 'inferred',
    },
  ];

  const filtered = filterEvents(sample, {
    ...BASE_FILTERS,
    search: '浦賀',
  });
  assert.equal(filtered.length, 2);

  const importanceFiltered = filterEvents(sample, {
    ...BASE_FILTERS,
    importance: 2,
  });
  assert.equal(importanceFiltered.length, 1);
  assert.equal(importanceFiltered[0].id, 'E003');

  const groups = groupEventsByEra(sample);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].eraLabel, '1850年代');
  assert.equal(groups[1].eraLabel, '1860年代');

  const connectedFromE2 = findConnectedEvents(sample[1], sample);
  assert.equal(connectedFromE2.reverseRelated.length, 1);
  assert.equal(connectedFromE2.reverseRelated[0].id, 'E001');

  const merged = mergeHistoricalDatabases(
    { events: [sample[0]] },
    { events: [sample[1], { ...sample[0], title: 'ペリー来航（改）' }] }
  );
  assert.equal(merged.events.length, 2);
  assert.equal(merged.events[0].title, 'ペリー来航（改）');
});

test('groupEventsByPlace, color grouping, color filtering, and extractPeopleDirectory work accurately', () => {
  const sample: HistoricalEvent[] = [
    {
      id: 'E001',
      date: '1853',
      date_precision: 'year',
      title: 'ペリー来航',
      description: '',
      people: ['マシュー・ペリー'],
      places: ['浦賀', '江戸湾'],
      category: ['diplomacy'],
      causes: [],
      consequences: [],
      related_events: [],
      importance: 3,
      source: '',
      certainty: 'explicit',
    },
    {
      id: 'E002',
      date: '1854',
      date_precision: 'year',
      title: '日米和親条約',
      description: '',
      people: ['マシュー・ペリー', '林復斎'],
      places: ['横浜', '浦賀'],
      category: ['diplomacy'],
      causes: [],
      consequences: [],
      related_events: [],
      importance: 3,
      source: '',
      certainty: 'explicit',
    },
    {
      id: 'E003',
      date: '1860',
      date_precision: 'year',
      title: '桜田門外の変',
      description: '',
      people: ['井伊直弼'],
      places: [],
      category: ['politics'],
      causes: [],
      consequences: [],
      related_events: [],
      importance: 2,
      source: '',
      certainty: 'explicit',
    },
  ];

  // Place grouping orders most frequent place first and 場所不明 last
  const placeGroups = groupEventsByPlace(sample);
  assert.equal(placeGroups[0].place, '浦賀');
  assert.equal(placeGroups[0].events.length, 2);
  assert.equal(placeGroups[placeGroups.length - 1].place, '場所不明');

  // Auto-color + color filter + color group
  const autoColors = autoAssignColorsByCategory(sample);
  assert.equal(autoColors.E001, 'lapis');
  assert.equal(autoColors.E003, 'vermilion');

  const lapisOnly = filterEvents(
    sample,
    { ...BASE_FILTERS, color: 'lapis' },
    autoColors
  );
  assert.deepEqual(lapisOnly.map((e) => e.id), ['E001', 'E002']);

  const colorGroups = groupEventsByColor(
    sample,
    { E001: 'lapis' },
    DEFAULT_COLOR_LABELS
  );
  assert.equal(colorGroups[0].colorId, 'lapis');
  assert.equal(colorGroups[0].events.length, 1);
  assert.equal(colorGroups[1].colorId, 'none');
  assert.equal(colorGroups[1].events.length, 2);

  // People directory extracts sorted by event count
  const people = extractPeopleDirectory(sample);
  assert.equal(people[0].name, 'マシュー・ペリー');
  assert.equal(people[0].events.length, 2);
  assert.equal(people[0].firstDate, '1853');
  assert.equal(people[0].lastDate, '1854');

  // Auto-color by importance and color counts
  const importanceColors = autoAssignColorsByImportance(sample);
  assert.equal(importanceColors.E001, 'vermilion');
  assert.equal(importanceColors.E003, 'amber');

  const counts = countEventsByColor(sample, { E001: 'lapis' });
  assert.equal(counts.total, 3);
  assert.equal(counts.assignedTotal, 1);
  assert.equal(counts.none, 2);
  assert.equal(counts.byColor.lapis, 1);
  assert.equal(counts.byColor.vermilion, 0);
});

test('getEventFocusRelation distinguishes selected, related-before, related-after, unrelated, and none', () => {
  const mk = (id: string, date: string, precision: HistoricalEvent['date_precision'] = 'year'): HistoricalEvent => ({
    id,
    date,
    date_precision: precision,
    title: id,
    description: '',
    people: [],
    places: [],
    category: ['politics'],
    causes: [],
    consequences: [],
    related_events: [],
    importance: 2,
    source: '',
    certainty: 'explicit',
  });

  const e1 = mk('E1', '1853');
  const e2 = mk('E2', '1858');
  const e3 = mk('E3', '1860');
  const e4 = mk('E4', '1871');
  const unknown = mk('E5', '不明', 'unknown');
  const related = new Set(['E1', 'E3', 'E5']);

  assert.equal(getEventFocusRelation(e1, null, related), 'none');
  assert.equal(getEventFocusRelation(e2, e2, related), 'selected');
  assert.equal(getEventFocusRelation(e1, e2, related), 'related-before');
  assert.equal(getEventFocusRelation(e3, e2, related), 'related-after');
  assert.equal(getEventFocusRelation(unknown, e2, related), 'related');
  assert.equal(getEventFocusRelation(e4, e2, related), 'unrelated');
});

test('toggleSelectedEventId selects new id and clears when tapping the already-selected id again', () => {
  assert.equal(toggleSelectedEventId(null, 'E001'), 'E001');
  assert.equal(toggleSelectedEventId('E001', 'E001'), null);
  assert.equal(toggleSelectedEventId('E001', 'E004'), 'E004');
});
