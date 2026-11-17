import assert from 'node:assert/strict';
import test from 'node:test';
import type { EventImagesMap } from '../types/timeline';
import {
  addEventImage,
  isValidEventImageUrl,
  removeEventImage,
  updateEventImage,
} from './eventImages';

test('isValidEventImageUrl accepts http/https, data URIs, and relative paths while rejecting unsafe/empty values', () => {
  assert.equal(isValidEventImageUrl('https://example.com/photo.jpg'), true);
  assert.equal(isValidEventImageUrl('http://example.com/map.png'), true);
  assert.equal(
    isValidEventImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg=='),
    true
  );
  assert.equal(isValidEventImageUrl('/assets/sample.png'), true);

  assert.equal(isValidEventImageUrl(''), false);
  assert.equal(isValidEventImageUrl('   '), false);
  assert.equal(isValidEventImageUrl('javascript:alert(1)'), false);
  assert.equal(isValidEventImageUrl('not a url'), false);
});

test('addEventImage, updateEventImage, and removeEventImage manage event images immutably', () => {
  const initial: EventImagesMap = {};

  const afterAdd1 = addEventImage(initial, 'E001', {
    id: 'img_1',
    url: 'https://example.com/perry.jpg',
    caption: '  黒船来航の図  ',
  });
  assert.equal(initial.E001, undefined);
  assert.equal(afterAdd1.E001.length, 1);
  assert.equal(afterAdd1.E001[0].caption, '黒船来航の図');

  const afterAdd2 = addEventImage(afterAdd1, 'E001', {
    id: 'img_2',
    url: 'data:image/png;base64,iVBORw0KGgo=',
    caption: '',
  });
  assert.equal(afterAdd2.E001.length, 2);
  assert.equal(afterAdd2.E001[1].caption, undefined);

  const afterInvalid = addEventImage(afterAdd2, 'E001', {
    url: 'javascript:alert(1)',
  });
  assert.equal(afterInvalid, afterAdd2);

  const afterUpdate = updateEventImage(afterAdd2, 'E001', 'img_1', {
    url: 'https://example.com/perry-v2.jpg',
    caption: '浦賀沖の黒船',
  });
  assert.equal(afterUpdate.E001[0].url, 'https://example.com/perry-v2.jpg');
  assert.equal(afterUpdate.E001[0].caption, '浦賀沖の黒船');

  const afterRemove1 = removeEventImage(afterUpdate, 'E001', 'img_1');
  assert.equal(afterRemove1.E001.length, 1);
  assert.equal(afterRemove1.E001[0].id, 'img_2');

  const afterRemoveAll = removeEventImage(afterRemove1, 'E001', 'img_2');
  assert.equal('E001' in afterRemoveAll, false);
});
