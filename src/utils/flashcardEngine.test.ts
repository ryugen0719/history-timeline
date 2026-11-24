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
assert.equal(parsed.cards.length, 310, 'All 310 questions must be preserved without deduplication');
assert.equal(parsed.cards[0].number, 1);
assert.equal(parsed.cards[0].back, '主権国家体制');
assert.equal(parsed.cards[309].number, 310);
assert.equal(parsed.cards[309].back, '幣原外交（国際協調政策）');

// Verify # prefix tags on No.288-310 are normalized cleanly
const card288 = parsed.cards[287];
assert.equal(card288.number, 288);
assert.equal(card288.tags.includes('分類_思想'), true);
assert.equal(card288.tags.some((t) => t.startsWith('#')), false);
assert.equal(parseTagMeta(card288.tags[0]).categoryKey, 'category');

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

console.log('All flashcard & SRS engine assertions passed (310/310 cards verified).');
