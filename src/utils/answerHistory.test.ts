import test from 'node:test';
import assert from 'node:assert/strict';
import type { AnswerHistoryEntry } from '../types/flashcards';
import {
  appendAnswerHistory,
  computeHistorySummary,
  filterAnswerHistory,
  formatHistoryDateHeading,
  getCardRecentHistory,
  groupHistoryByDate,
  removeAnswerHistoryEntry,
} from './answerHistory';

function makeEntry(
  overrides: Partial<AnswerHistoryEntry> & { id: string; cardId: string }
): AnswerHistoryEntry {
  return {
    scopeId: 'scope-term3-exam',
    cardNumber: 1,
    unit: '23. 日清戦争',
    front: '1894年に調印された日英の条約は何か。',
    back: '日英通商航海条約',
    rating: 3,
    mode: 'flip',
    recordedToSrs: true,
    answeredAt: new Date(2026, 10, 27, 10, 0).getTime(),
    ...overrides,
  };
}

test('appendAnswerHistory prepends newest entries and enforces max cap', () => {
  const e1 = makeEntry({ id: 'h1', cardId: 'c1', answeredAt: 1000 });
  const e2 = makeEntry({ id: 'h2', cardId: 'c2', answeredAt: 2000 });
  const e3 = makeEntry({ id: 'h3', cardId: 'c3', answeredAt: 3000 });

  let list: AnswerHistoryEntry[] = [];
  list = appendAnswerHistory(list, e1, 2);
  list = appendAnswerHistory(list, e2, 2);
  list = appendAnswerHistory(list, e3, 2);

  assert.deepEqual(
    list.map((e) => e.id),
    ['h3', 'h2']
  );
});

test('removeAnswerHistoryEntry cleanly removes undone entries', () => {
  const list = [
    makeEntry({ id: 'h2', cardId: 'c2' }),
    makeEntry({ id: 'h1', cardId: 'c1' }),
  ];
  const afterUndo = removeAnswerHistoryEntry(list, 'h2');
  assert.deepEqual(
    afterUndo.map((e) => e.id),
    ['h1']
  );
});

test('filterAnswerHistory filters by scope, rating, mode, and search query including typedAnswer', () => {
  const entries: AnswerHistoryEntry[] = [
    makeEntry({
      id: 'h1',
      cardId: 'c1',
      cardNumber: 65,
      rating: 1,
      mode: 'typing',
      typedAnswer: '日英同盟',
      typingVerdict: 'mismatch',
    }),
    makeEntry({
      id: 'h2',
      cardId: 'c2',
      cardNumber: 66,
      rating: 3,
      mode: 'flip',
      front: '下関条約の賠償金はいくらか。',
      back: '2億両',
    }),
    makeEntry({
      id: 'h3',
      cardId: 'c3',
      scopeId: 'other-scope',
      rating: 1,
      mode: 'redsheet',
    }),
  ];

  assert.equal(
    filterAnswerHistory(entries, { scopeId: 'scope-term3-exam' }).length,
    2
  );
  assert.deepEqual(
    filterAnswerHistory(entries, {
      scopeId: 'scope-term3-exam',
      ratingFilter: 'again',
    }).map((e) => e.id),
    ['h1']
  );
  assert.deepEqual(
    filterAnswerHistory(entries, { modeFilter: 'typing' }).map((e) => e.id),
    ['h1']
  );
  assert.deepEqual(
    filterAnswerHistory(entries, { search: '日英同盟' }).map((e) => e.id),
    ['h1']
  );
  assert.deepEqual(
    filterAnswerHistory(entries, { search: 'no.66' }).map((e) => e.id),
    ['h2']
  );
});

test('computeHistorySummary calculates accuracy and deduplicated weak card IDs', () => {
  const entries: AnswerHistoryEntry[] = [
    makeEntry({ id: 'h4', cardId: 'c1', rating: 1 }),
    makeEntry({ id: 'h3', cardId: 'c2', rating: 3 }),
    makeEntry({ id: 'h2', cardId: 'c1', rating: 1 }),
    makeEntry({ id: 'h1', cardId: 'c3', rating: 4 }),
  ];

  const summary = computeHistorySummary(entries);
  assert.equal(summary.total, 4);
  assert.equal(summary.correctCount, 2);
  assert.equal(summary.againCount, 2);
  assert.equal(summary.accuracyPercent, 50);
  assert.deepEqual(summary.uniqueCardIds, ['c1', 'c2', 'c3']);
  assert.deepEqual(summary.weakCardIds, ['c1']);
});

test('groupHistoryByDate groups entries into 今日, 昨日, and formatted dates', () => {
  const now = new Date(2026, 10, 27, 15, 30).getTime();
  const todayEntry = makeEntry({
    id: 'h3',
    cardId: 'c3',
    answeredAt: new Date(2026, 10, 27, 14, 0).getTime(),
  });
  const yesterdayEntry = makeEntry({
    id: 'h2',
    cardId: 'c2',
    answeredAt: new Date(2026, 10, 26, 20, 0).getTime(),
  });
  const olderEntry = makeEntry({
    id: 'h1',
    cardId: 'c1',
    answeredAt: new Date(2026, 10, 20, 9, 0).getTime(),
  });

  const groups = groupHistoryByDate([todayEntry, yesterdayEntry, olderEntry], now);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].label, '今日');
  assert.equal(groups[1].label, '昨日');
  assert.equal(groups[2].label, formatHistoryDateHeading('2026-11-20', now));
  assert.ok(groups[2].label.includes('11月20日'));
});

test('getCardRecentHistory returns at most limit recent entries for a card', () => {
  const entries = [
    makeEntry({ id: 'h4', cardId: 'c1', rating: 4 }),
    makeEntry({ id: 'h3', cardId: 'c2', rating: 1 }),
    makeEntry({ id: 'h2', cardId: 'c1', rating: 3 }),
    makeEntry({ id: 'h1', cardId: 'c1', rating: 1 }),
  ];

  const recent = getCardRecentHistory(entries, 'c1', 2);
  assert.deepEqual(
    recent.map((e) => e.id),
    ['h4', 'h2']
  );
});
