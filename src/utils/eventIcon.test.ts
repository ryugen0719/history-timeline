import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import { resolveEventIcon } from './eventIcon';

test('resolveEventIcon selects content-appropriate icon kinds for Bakumatsu events', () => {
  const events = SAMPLE_DATASETS[0].data.events;
  const byId = new Map(events.map((e) => [e.id, e]));

  assert.equal(resolveEventIcon(byId.get('E001')!).kind, 'ship'); // ペリー来航
  assert.equal(resolveEventIcon(byId.get('E002')!).kind, 'handshake'); // 日米和親条約
  assert.equal(resolveEventIcon(byId.get('E004')!).kind, 'shield-alert'); // 安政の大獄
  assert.equal(resolveEventIcon(byId.get('E005')!).kind, 'swords'); // 桜田門外の変
  assert.equal(resolveEventIcon(byId.get('E006')!).kind, 'handshake'); // 薩長同盟
  assert.equal(resolveEventIcon(byId.get('E007')!).kind, 'landmark'); // 大政奉還
  assert.equal(resolveEventIcon(byId.get('E008')!).kind, 'swords'); // 王政復古と戊辰戦争
  assert.equal(resolveEventIcon(byId.get('E009')!).kind, 'scroll'); // 五箇条の御誓文
  assert.equal(resolveEventIcon(byId.get('E011')!).kind, 'train'); // 学制発布と鉄道開通
  assert.equal(resolveEventIcon(byId.get('E012')!).kind, 'coins'); // 地租改正と徴兵令
  assert.equal(resolveEventIcon(byId.get('E013')!).kind, 'scroll'); // 大日本帝国憲法
  assert.equal(resolveEventIcon(byId.get('E014')!).kind, 'landmark'); // 第1回帝国議会
});

test('resolveEventIcon handles World history and category fallbacks cleanly', () => {
  const frEvents = SAMPLE_DATASETS[1].data.events;
  const frById = new Map(frEvents.map((e) => [e.id, e]));
  assert.equal(resolveEventIcon(frById.get('FR02')!).kind, 'swords'); // バスティーユ牢獄襲撃
  assert.equal(resolveEventIcon(frById.get('FR03')!).kind, 'scroll'); // フランス人権宣言
  assert.equal(resolveEventIcon(frById.get('FR07')!).kind, 'scale'); // ナポレオン法典

  const fallback = resolveEventIcon({
    title: '未知の出来事',
    description: '',
    category: ['society'],
  });
  assert.equal(fallback.kind, 'users');
});
