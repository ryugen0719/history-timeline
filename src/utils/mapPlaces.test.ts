import test from 'node:test';
import assert from 'node:assert/strict';
import type { HistoricalEvent } from '../types/timeline';
import {
  buildPlaceSearchQuery,
  collectPlaceEventGroups,
  getPlacePinAppearance,
  isMappablePlaceName,
} from './mapPlaces';

function makeEvent(
  id: string,
  places: string[],
  importance: 1 | 2 | 3 = 2
): HistoricalEvent {
  return {
    id,
    date: '1860',
    date_precision: 'year',
    title: `出来事 ${id}`,
    description: '',
    people: [],
    places,
    category: ['politics'],
    causes: [],
    consequences: [],
    related_events: [],
    importance,
    source: '',
    certainty: 'explicit',
  };
}

test('isMappablePlaceName filters out unknown and nationwide terms', () => {
  assert.equal(isMappablePlaceName(''), false);
  assert.equal(isMappablePlaceName('不明'), false);
  assert.equal(isMappablePlaceName('場所不明'), false);
  assert.equal(isMappablePlaceName('全国'), false);
  assert.equal(isMappablePlaceName('全国各藩'), false);
  assert.equal(isMappablePlaceName('浦賀'), true);
  assert.equal(isMappablePlaceName('パリ'), true);
});

test('buildPlaceSearchQuery disambiguates historical place names without hardcoding coordinates', () => {
  assert.equal(buildPlaceSearchQuery('江戸'), '江戸城 東京都千代田区');
  assert.equal(buildPlaceSearchQuery('長州'), '山口県萩市 長州');
  assert.equal(buildPlaceSearchQuery('フィレンツェ'), 'フィレンツェ');
});

test('collectPlaceEventGroups aggregates mappable places and preserves non-mappable events', () => {
  const events = [
    makeEvent('E1', ['江戸', '京都'], 3),
    makeEvent('E2', ['京都'], 2),
    makeEvent('E3', ['全国'], 3),
    makeEvent('E4', ['不明'], 1),
  ];

  const result = collectPlaceEventGroups(events, { E1: 'vermilion' });

  assert.equal(result.mappableGroups.length, 2);
  assert.equal(result.mappableGroups[0].placeName, '京都');
  assert.equal(result.mappableGroups[0].events.length, 2);
  assert.deepEqual(result.mappableGroups[0].assignedColorIds, ['vermilion']);

  assert.equal(result.mappableGroups[1].placeName, '江戸');
  assert.equal(result.mappableGroups[1].events.length, 1);

  assert.deepEqual(
    result.nonMappableEvents.map((e) => e.id),
    ['E3', 'E4']
  );
});

test('getPlacePinAppearance highlights selected event and respects assigned colors', () => {
  const ev1 = makeEvent('E1', ['京都'], 2);
  const ev2 = makeEvent('E2', ['京都'], 3);
  const group = {
    placeName: '京都',
    events: [ev1, ev2],
    maxImportance: 3 as const,
    assignedColorIds: ['lapis' as const],
  };

  const selected = getPlacePinAppearance({
    group,
    selectedEventId: 'E2',
    eventColors: { E2: 'lapis' },
  });
  assert.equal(selected.isSelected, true);
  assert.equal(selected.scale, 1.32);
  assert.equal(selected.background, '#1D4ED8');

  const unselected = getPlacePinAppearance({
    group,
    selectedEventId: 'OTHER',
    eventColors: { E2: 'lapis' },
  });
  assert.equal(unselected.isSelected, false);
  assert.equal(unselected.scale, 1.0);
  assert.equal(unselected.background, '#1D4ED8');
});
