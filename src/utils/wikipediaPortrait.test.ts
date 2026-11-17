import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chunkArray,
  mergeWikipediaPortraits,
  normalizeWikipediaLookupName,
  parseMediaWikiQueryResponse,
} from './wikipediaPortrait';

test('normalizeWikipediaLookupName and chunkArray work correctly', () => {
  assert.equal(normalizeWikipediaLookupName('徳川慶喜（第15代将軍）'), '徳川慶喜');
  assert.equal(normalizeWikipediaLookupName('  マシュー・ペリー  '), 'マシュー・ペリー');
  assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

test('parseMediaWikiQueryResponse resolves normalized titles, redirects, thumbnails, and en langlinks', () => {
  const mockResponse = {
    query: {
      normalized: [{ from: 'マシュー・ペリー', to: 'マシュー・ペリー' }],
      redirects: [{ from: 'ペリー', to: 'マシュー・ペリー' }],
      pages: {
        '26103': {
          pageid: 26103,
          title: 'マシュー・ペリー',
          thumbnail: {
            source: 'https://upload.wikimedia.org/perry.png',
          },
          description: 'アメリカの海軍軍人',
          langlinks: [{ lang: 'en', '*': 'Matthew C. Perry' }],
        },
        '-1': {
          missing: '',
          title: '架空の人物',
        },
      },
    },
  };

  const parsed = parseMediaWikiQueryResponse(mockResponse, [
    'ペリー',
    '架空の人物',
  ]);
  assert.equal(parsed.get('ペリー')?.photoUrl, 'https://upload.wikimedia.org/perry.png');
  assert.equal(parsed.get('ペリー')?.description, 'アメリカの海軍軍人');
  assert.equal(parsed.get('ペリー')?.enTitle, 'Matthew C. Perry');
  assert.equal(parsed.has('架空の人物'), false);
});

test('mergeWikipediaPortraits fills missing photos while preserving manual registrations', () => {
  const existing = {
    大久保利通: { photoUrl: 'data:image/jpeg;base64,manual', note: '手動メモ' },
    坂本龍馬: { photoUrl: '', note: '土佐藩出身' },
  };

  const fetched = {
    大久保利通: { photoUrl: 'https://upload.wikimedia.org/okubo.jpg', note: '自動メモ' },
    坂本龍馬: { photoUrl: 'https://upload.wikimedia.org/ryoma.jpg', note: '日本の志士' },
    西郷隆盛: { photoUrl: 'https://upload.wikimedia.org/saigo.jpg', note: '薩摩藩士' },
  };

  const merged = mergeWikipediaPortraits(existing, fetched);
  assert.equal(merged.大久保利通.photoUrl, 'data:image/jpeg;base64,manual');
  assert.equal(merged.大久保利通.note, '手動メモ');
  assert.equal(merged.坂本龍馬.photoUrl, 'https://upload.wikimedia.org/ryoma.jpg');
  assert.equal(merged.坂本龍馬.note, '土佐藩出身');
  assert.equal(merged.西郷隆盛.photoUrl, 'https://upload.wikimedia.org/saigo.jpg');
  assert.equal(merged.西郷隆盛.note, '薩摩藩士');
});
