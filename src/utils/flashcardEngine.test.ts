import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFlashcardsCsv, parseTagMeta } from './flashcardParser';
import {
  calculateRetentionPercent,
  createInitialSrsProgress,
  evaluateTypedAnswer,
  previewRatingIntervals,
  scheduleNextReview,
} from './srsEngine';

const csvPath = path.resolve(process.cwd(), 'src/data/term3Exam.csv');
const rawCsv = fs.readFileSync(csvPath, 'utf-8');

const parsed = parseFlashcardsCsv(rawCsv, {
  scopeId: 'scope-term3-exam',
  idPrefix: 'term3',
});

assert.equal(parsed.ok, true, 'CSV should parse cleanly');
assert.equal(parsed.cards.length, 289, 'All 289 deduplicated questions must be preserved');
assert.equal(parsed.cards[0].number, 1);
assert.equal(parsed.cards[0].back, '主権国家体制');
assert.equal(parsed.cards[288].number, 289);
assert.equal(parsed.cards[288].back, '幣原外交（国際協調政策）');

// Verify zero duplicate question prompts across the entire dataset
const seenFronts = new Set<string>();
for (const card of parsed.cards) {
  assert.equal(
    seenFronts.has(card.front),
    false,
    `Duplicate question found at No.${card.number}: ${card.front}`
  );
  seenFronts.add(card.front);
}

// Verify Lesson 23 and Lesson 24 separation
const lesson23Cards = parsed.cards.filter((c) => c.unit === '23. 日清戦争');
const lesson24Cards = parsed.cards.filter(
  (c) => c.unit === '24. 日露戦争から韓国併合へ'
);
assert.equal(lesson23Cards.length, 21, 'Lesson 23 should have 21 cards');
assert.equal(lesson24Cards.length, 24, 'Lesson 24 should have 24 cards');
assert.equal(
  lesson24Cards.some((c) => c.tags.includes('授業_23_日清戦争')),
  false,
  'Lesson 24 must not contain Lesson 23 tagged questions'
);

// Verify # prefix tags on No.267-289 are normalized cleanly
const card267 = parsed.cards[266];
assert.equal(card267.number, 267);
assert.equal(card267.tags.includes('分類_思想'), true);
assert.equal(card267.tags.some((t) => t.startsWith('#')), false);
assert.equal(parseTagMeta(card267.tags[0]).categoryKey, 'category');

// Verify SM-2 forgetting curve scheduler
const now = 1764000000000;
const initial = createInitialSrsProgress('term3-0001');
const previews = previewRatingIntervals(initial, now);
assert.equal(previews[1], '10分後');
assert.equal(previews[3], '1日後');
assert.equal(previews[4], '4日後');

const afterGood = scheduleNextReview(initial, 3, now);
assert.equal(afterGood.next.state, 'review');
assert.equal(afterGood.next.intervalDays, 1);
assert.equal(afterGood.requeueInSession, false);

const retImmediate = calculateRetentionPercent(afterGood.next, now);
assert.equal(retImmediate, 100);
const retLater = calculateRetentionPercent(afterGood.next, now + 2 * 24 * 60 * 60 * 1000);
assert.ok(retLater !== null && retLater < 100 && retLater > 30);

const afterAgain = scheduleNextReview(afterGood.next, 1, now + 24 * 60 * 60 * 1000);
assert.equal(afterAgain.requeueInSession, true);
assert.equal(afterAgain.next.lapses, 1);

// Verify Japanese typing evaluation
assert.equal(evaluateTypedAnswer('幣原外交', '幣原外交（国際協調政策）').verdict, 'exact');
assert.equal(evaluateTypedAnswer('主権国家体制', '主権国家体制').verdict, 'exact');

console.log('All flashcard & SRS engine assertions passed (289/289 cards verified, 0 duplicates).');
