import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import {
  buildRegionMatrixRows,
  computeRegionRelationships,
  findRelatedEventIdsForHighlight,
  formatSubDateInYearRow,
  getEventYearBucket,
  groupEventsByRegion,
  resolveMacroRegion,
} from './regionGrouping';

test('resolveMacroRegion maps granular historical places to coherent macro-regions', () => {
  assert.equal(resolveMacroRegion('浦賀'), '関東（江戸・東京・開港地）');
  assert.equal(resolveMacroRegion('江戸'), '関東（江戸・東京・開港地）');
  assert.equal(resolveMacroRegion('東京'), '関東（江戸・東京・開港地）');
  assert.equal(resolveMacroRegion('鳥羽・伏見'), '近畿（京都・大坂・兵庫）');
  assert.equal(resolveMacroRegion('薩摩'), '西日本・九州（薩摩・長州・長崎）');
  assert.equal(resolveMacroRegion('会津'), '東北・北日本（会津・箱館・新潟）');
  assert.equal(resolveMacroRegion('ヴェルサイユ'), 'フランス');
  assert.equal(resolveMacroRegion('不明'), '場所不明');
});

test('groupEventsByRegion consolidates Bakumatsu dataset from 18+ raw places into <= 6 regions', () => {
  const bakumatsu = SAMPLE_DATASETS[0].data.events;
  const macroGroups = groupEventsByRegion(bakumatsu, 'macro');
  const exactGroups = groupEventsByRegion(bakumatsu, 'exact');

  assert.ok(exactGroups.length >= 15);
  assert.ok(macroGroups.length <= 6);
  assert.equal(macroGroups[0].region, '関東（江戸・東京・開港地）');
  assert.ok(macroGroups[0].subPlaces.includes('浦賀'));
  assert.ok(macroGroups[0].subPlaces.includes('東京'));
});

test('computeRegionRelationships identifies shared events and cross-region causal links', () => {
  const bakumatsu = SAMPLE_DATASETS[0].data.events;
  const macroGroups = groupEventsByRegion(bakumatsu, 'macro');
  const links = computeRegionRelationships(bakumatsu, macroGroups, 'macro');

  assert.ok(links.length > 0);
  const kantoKinki = links.find(
    (l) =>
      (l.regionA.startsWith('関東') && l.regionB.startsWith('近畿')) ||
      (l.regionB.startsWith('関東') && l.regionA.startsWith('近畿'))
  );
  assert.ok(kantoKinki);
  assert.ok(kantoKinki.sharedEvents.length >= 2);
  assert.ok(kantoKinki.causalLinks.length >= 1);

  const highlightIds = findRelatedEventIdsForHighlight(bakumatsu[0], bakumatsu);
  assert.ok(highlightIds.has('E002'));
  assert.ok(highlightIds.has('E003'));
});

test('getEventYearBucket and formatSubDateInYearRow organize rows by year cleanly', () => {
  const bakumatsu = SAMPLE_DATASETS[0].data.events;
  const perry = bakumatsu.find((e) => e.id === 'E001')!;
  const ansei = bakumatsu.find((e) => e.id === 'E004')!;

  const b1 = getEventYearBucket(perry);
  assert.equal(b1.label, '1853年');
  assert.equal(formatSubDateInYearRow(perry, b1.label), '7月8日');

  const b4 = getEventYearBucket(ansei);
  assert.equal(b4.label, '1858年');
  assert.equal(formatSubDateInYearRow(ansei, b4.label), null);
});

test('buildRegionMatrixRows prevents duplicate cards, preserves chronological bands, and tracks hiddenRegions', () => {
  const bakumatsu = SAMPLE_DATASETS[0].data.events;
  const macroGroups = groupEventsByRegion(bakumatsu, 'macro');
  const visibleRegions = macroGroups.map((g) => g.region);
  const allSet = new Set(visibleRegions);

  const rows = buildRegionMatrixRows(bakumatsu, visibleRegions, 'macro', allSet);

  // Every event in bakumatsu appears exactly once across all bands
  const renderedIds: string[] = [];
  for (const row of rows) {
    for (const band of row.bands) {
      if (band.type === 'single') {
        for (const items of band.singleByRegion.values()) {
          for (const item of items) renderedIds.push(item.event.id);
        }
      } else {
        renderedIds.push(band.spanItem.event.id);
        assert.ok(band.spanItem.regionIndices.length >= 2);
        assert.equal(band.spanItem.minCol, band.spanItem.regionIndices[0]);
        assert.equal(
          band.spanItem.maxCol,
          band.spanItem.regionIndices[band.spanItem.regionIndices.length - 1]
        );
      }
    }
  }
  assert.equal(renderedIds.length, bakumatsu.length);
  assert.equal(new Set(renderedIds).size, bakumatsu.length);

  // Check 1868 row orders E008 (Jan 3, span anchored in 近畿) BEFORE E009 (Apr 6, single)
  const row1868 = rows.find((r) => r.label === '1868年');
  assert.ok(row1868);
  assert.equal(row1868.bands.length, 2);
  assert.equal(row1868.bands[0].type, 'span');
  if (row1868.bands[0].type === 'span') {
    const span = row1868.bands[0].spanItem;
    assert.equal(span.event.id, 'E008');
    assert.ok(span.anchorRegion.startsWith('近畿'));
    assert.equal(visibleRegions[span.anchorCol], span.anchorRegion);
    const tohokuIdx = visibleRegions.findIndex((r) => r.startsWith('東北'));
    assert.deepEqual(span.placesByCol[tohokuIdx], ['会津', '箱館']);
  }
  assert.equal(row1868.bands[1].type, 'single');

  // Filtering down to 2 regions preserves hiddenRegions (e.g., E002 links Kanto + Tohoku)
  const twoRegions = visibleRegions.slice(0, 2); // 関東, 近畿
  const filteredRows = buildRegionMatrixRows(bakumatsu, twoRegions, 'macro', allSet);
  const filtered1854 = filteredRows.find((r) => r.label === '1854年');
  assert.ok(filtered1854);
  assert.equal(filtered1854.bands[0].type, 'single');
  if (filtered1854.bands[0].type === 'single') {
    const kantoItems = filtered1854.bands[0].singleByRegion.get(twoRegions[0]) ?? [];
    assert.equal(kantoItems[0].event.id, 'E002');
    assert.ok(kantoItems[0].hiddenRegions.some((r) => r.startsWith('東北')));
  }
});

