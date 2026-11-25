import test from 'node:test';
import assert from 'node:assert/strict';
import type { Flashcard, PersistedStudySession } from '../types/flashcards';
import {
  classifySwipeGesture,
  computeRedSheetStats,
  filterRedSheetCards,
  getRecommendedRatingForTyping,
  reconcilePersistedSession,
  skipCardInQueue,
  uniqueCardsFromQueueIds,
} from './studySession';

const mockCard = (id: string, num: number): Flashcard => ({
  id,
  scopeId: 'scope-term3-exam',
  number: num,
  deckPath: '',
  chapter: '第4章',
  unit: '23. 日清戦争',
  front: `問題 ${num}`,
  back: `解答 ${num}`,
  tags: [],
  createdAt: 1,
  updatedAt: 1,
});

test('getRecommendedRatingForTyping maps verdicts to ergonomic SRS ratings', () => {
  assert.equal(getRecommendedRatingForTyping('exact'), 3);
  assert.equal(getRecommendedRatingForTyping('partial'), 2);
  assert.equal(getRecommendedRatingForTyping('mismatch'), 1);
});

test('skipCardInQueue defers current card to end of remaining queue without losing it', () => {
  const res = skipCardInQueue(['a', 'b', 'c', 'd'], 1, 'defer');
  assert.deepEqual(res.queueIds, ['a', 'c', 'd', 'b']);
  assert.equal(res.nextIndex, 1);

  // Deferring the final card leaves queue unchanged
  const lastRes = skipCardInQueue(['a', 'b'], 1, 'defer');
  assert.deepEqual(lastRes.queueIds, ['a', 'b']);
  assert.equal(lastRes.nextIndex, 1);
});

test('skipCardInQueue next mode advances index safely', () => {
  const res = skipCardInQueue(['a', 'b', 'c'], 0, 'next');
  assert.deepEqual(res.queueIds, ['a', 'b', 'c']);
  assert.equal(res.nextIndex, 1);
});

test('reconcilePersistedSession removes deleted cards, adjusts cursor, and drops completed sessions', () => {
  const baseSession: PersistedStudySession = {
    sessionId: 'sess-1',
    config: {
      scopeId: 'scope-term3-exam',
      chapter: 'all',
      unit: '23. 日清戦争',
      selectedTags: [],
      tagMatchMode: 'and',
      filterPreset: 'all',
      orderMode: 'unit',
      swapFrontBack: false,
      recordToSrs: true,
      mode: 'flip',
      label: '23. 日清戦争',
    },
    queueIds: ['c1', 'c2', 'c3', 'c4'],
    currentIndex: 2,
    ratingCounts: { 1: 0, 2: 0, 3: 2, 4: 0 },
    againCardIds: ['c2'],
    redSheetRated: {},
    updatedAt: 1000,
  };

  // c1 was deleted before cursor (index 0 < 2), so cursor shifts from 2 -> 1 (still pointing at c3)
  const reconciled = reconcilePersistedSession(
    baseSession,
    new Set(['c2', 'c3', 'c4'])
  );
  assert.ok(reconciled);
  assert.deepEqual(reconciled.queueIds, ['c2', 'c3', 'c4']);
  assert.equal(reconciled.currentIndex, 1);
  assert.equal(reconciled.queueIds[reconciled.currentIndex], 'c3');

  // Completed session returns null
  const completed = reconcilePersistedSession(
    { ...baseSession, currentIndex: 4 },
    new Set(['c1', 'c2', 'c3', 'c4'])
  );
  assert.equal(completed, null);
});

test('filterRedSheetCards and computeRedSheetStats track progress accurately', () => {
  const cards = [mockCard('c1', 1), mockCard('c2', 2), mockCard('c3', 3)];
  const rated = { c1: 3 as const, c2: 1 as const };

  assert.deepEqual(computeRedSheetStats(cards, rated), {
    total: 3,
    rated: 2,
    again: 1,
    remembered: 1,
  });

  assert.deepEqual(
    filterRedSheetCards(cards, rated, 'unrated').map((c) => c.id),
    ['c3']
  );
  assert.deepEqual(
    filterRedSheetCards(cards, rated, 'again').map((c) => c.id),
    ['c2']
  );
  assert.equal(filterRedSheetCards(cards, rated, 'all').length, 3);
});

test('classifySwipeGesture detects intentional horizontal swipes and ignores vertical scrolling', () => {
  assert.equal(classifySwipeGesture(-80, 10), 'left');
  assert.equal(classifySwipeGesture(85, -15), 'right');
  assert.equal(classifySwipeGesture(40, 5), null);
  assert.equal(classifySwipeGesture(80, 90), null);
});

test('uniqueCardsFromQueueIds deduplicates re-queued card IDs for Red Sheet mode', () => {
  const map = {
    c1: mockCard('c1', 1),
    c2: mockCard('c2', 2),
    c3: mockCard('c3', 3),
  };
  const unique = uniqueCardsFromQueueIds(['c1', 'c2', 'c1', 'c3', 'missing'], map);
  assert.deepEqual(
    unique.map((c) => c.id),
    ['c1', 'c2', 'c3']
  );
});
