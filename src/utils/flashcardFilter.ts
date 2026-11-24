import type {
  Flashcard,
  ParsedTagMeta,
  SrsProgressMap,
  StudySessionConfig,
  TagCategoryKey,
} from '../types/flashcards';
import { parseTagMeta, TAG_CATEGORY_ORDER } from './flashcardParser';
import {
  calculateRetentionPercent,
  getSrsProgress,
  isCardDue,
  isCardMastered,
  isCardWeak,
} from './srsEngine';

export interface UnitSummary {
  chapter: string;
  unit: string;
  total: number;
  due: number;
  newCount: number;
  learned: number;
  mastered: number;
  weak: number;
  avgRetention: number | null;
}

export interface ChapterGroup {
  chapter: string;
  units: UnitSummary[];
  total: number;
  due: number;
  learned: number;
  mastered: number;
}

export interface TagStatItem {
  meta: ParsedTagMeta;
  total: number;
  due: number;
  weak: number;
  learned: number;
  mastered: number;
  avgRetention: number | null;
}

export interface TagCategoryGroup {
  key: TagCategoryKey;
  label: string;
  items: TagStatItem[];
}

export function filterCardsByBaseCriteria(
  cards: Flashcard[],
  config: Pick<
    StudySessionConfig,
    'scopeId' | 'chapter' | 'unit' | 'selectedTags' | 'tagMatchMode'
  >,
  includeSuspended: boolean = false
): Flashcard[] {
  return cards.filter((card) => {
    if (!includeSuspended && card.suspended) return false;
    if (config.scopeId !== 'all' && card.scopeId !== config.scopeId) {
      return false;
    }
    if (config.chapter !== 'all' && card.chapter !== config.chapter) {
      return false;
    }
    if (config.unit !== 'all' && card.unit !== config.unit) {
      return false;
    }
    if (config.selectedTags.length > 0) {
      if (config.tagMatchMode === 'and') {
        for (const tag of config.selectedTags) {
          if (!card.tags.includes(tag)) return false;
        }
      } else {
        const matched = config.selectedTags.some((tag) =>
          card.tags.includes(tag)
        );
        if (!matched) return false;
      }
    }
    return true;
  });
}

export function buildStudyQueue(
  cards: Flashcard[],
  srsMap: SrsProgressMap,
  config: StudySessionConfig,
  nowMs: number = Date.now()
): Flashcard[] {
  const base = filterCardsByBaseCriteria(cards, config, false);

  let filtered: Flashcard[];
  switch (config.filterPreset) {
    case 'due': {
      // Due reviews first; if also wanting due-only, keep due + learning/relearning due now
      filtered = base.filter((card) => {
        const prog = getSrsProgress(srsMap, card.id);
        return isCardDue(prog, nowMs);
      });
      break;
    }
    case 'new': {
      filtered = base.filter(
        (card) => getSrsProgress(srsMap, card.id).state === 'new'
      );
      break;
    }
    case 'weak': {
      filtered = base.filter((card) =>
        isCardWeak(getSrsProgress(srsMap, card.id), nowMs)
      );
      break;
    }
    case 'starred': {
      filtered = base.filter((card) => Boolean(card.starred));
      break;
    }
    case 'all':
    default: {
      filtered = [...base];
      break;
    }
  }

  if (config.orderMode === 'shuffle') {
    const arr = [...filtered];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  if (config.orderMode === 'unit') {
    return [...filtered].sort((a, b) => a.number - b.number);
  }

  // 'srs' order: overdue/lowest retention first -> due soon -> new -> future review
  return [...filtered].sort((a, b) => {
    const pa = getSrsProgress(srsMap, a.id);
    const pb = getSrsProgress(srsMap, b.id);

    const priority = (p: typeof pa): number => {
      if (isCardDue(p, nowMs)) return 0;
      if (p.state === 'relearning' || p.state === 'learning') return 1;
      if (p.state === 'new') return 2;
      return 3;
    };

    const diffP = priority(pa) - priority(pb);
    if (diffP !== 0) return diffP;

    if (pa.dueAt !== null && pb.dueAt !== null && pa.dueAt !== pb.dueAt) {
      return pa.dueAt - pb.dueAt;
    }

    return a.number - b.number;
  });
}

export function buildChapterHierarchy(
  cards: Flashcard[],
  srsMap: SrsProgressMap,
  nowMs: number = Date.now()
): ChapterGroup[] {
  const chapterOrder: string[] = [];
  const chapterUnitMap = new Map<string, Map<string, Flashcard[]>>();

  for (const card of cards) {
    if (card.suspended) continue;
    if (!chapterUnitMap.has(card.chapter)) {
      chapterOrder.push(card.chapter);
      chapterUnitMap.set(card.chapter, new Map());
    }
    const unitMap = chapterUnitMap.get(card.chapter)!;
    if (!unitMap.has(card.unit)) {
      unitMap.set(card.unit, []);
    }
    unitMap.get(card.unit)!.push(card);
  }

  return chapterOrder.map((chapter) => {
    const unitMap = chapterUnitMap.get(chapter)!;
    const units: UnitSummary[] = [];
    let chTotal = 0;
    let chDue = 0;
    let chLearned = 0;
    let chMastered = 0;

    for (const [unit, unitCards] of unitMap.entries()) {
      let due = 0;
      let newCount = 0;
      let learned = 0;
      let mastered = 0;
      let weak = 0;
      let retSum = 0;
      let retCount = 0;

      for (const c of unitCards) {
        const prog = getSrsProgress(srsMap, c.id);
        if (prog.state === 'new') {
          newCount += 1;
        } else {
          learned += 1;
          const ret = calculateRetentionPercent(prog, nowMs);
          if (ret !== null) {
            retSum += ret;
            retCount += 1;
          }
        }
        if (isCardDue(prog, nowMs)) due += 1;
        if (isCardMastered(prog)) mastered += 1;
        if (isCardWeak(prog, nowMs)) weak += 1;
      }

      chTotal += unitCards.length;
      chDue += due;
      chLearned += learned;
      chMastered += mastered;

      units.push({
        chapter,
        unit,
        total: unitCards.length,
        due,
        newCount,
        learned,
        mastered,
        weak,
        avgRetention: retCount > 0 ? Math.round(retSum / retCount) : null,
      });
    }

    return {
      chapter,
      units,
      total: chTotal,
      due: chDue,
      learned: chLearned,
      mastered: chMastered,
    };
  });
}

export function buildTagCategoryGroups(
  cards: Flashcard[],
  srsMap: SrsProgressMap,
  nowMs: number = Date.now()
): TagCategoryGroup[] {
  const statsMap = new Map<
    string,
    {
      meta: ParsedTagMeta;
      total: number;
      due: number;
      weak: number;
      learned: number;
      mastered: number;
      retSum: number;
      retCount: number;
    }
  >();

  for (const card of cards) {
    if (card.suspended) continue;
    const prog = getSrsProgress(srsMap, card.id);
    const due = isCardDue(prog, nowMs);
    const weak = isCardWeak(prog, nowMs);
    const learned = prog.state !== 'new';
    const mastered = isCardMastered(prog);
    const ret = calculateRetentionPercent(prog, nowMs);

    for (const tag of card.tags) {
      let entry = statsMap.get(tag);
      if (!entry) {
        entry = {
          meta: parseTagMeta(tag),
          total: 0,
          due: 0,
          weak: 0,
          learned: 0,
          mastered: 0,
          retSum: 0,
          retCount: 0,
        };
        statsMap.set(tag, entry);
      }
      entry.total += 1;
      if (due) entry.due += 1;
      if (weak) entry.weak += 1;
      if (learned) entry.learned += 1;
      if (mastered) entry.mastered += 1;
      if (ret !== null) {
        entry.retSum += ret;
        entry.retCount += 1;
      }
    }
  }

  const grouped = new Map<TagCategoryKey, TagStatItem[]>();
  for (const cat of TAG_CATEGORY_ORDER) {
    grouped.set(cat.key, []);
  }

  for (const entry of statsMap.values()) {
    grouped.get(entry.meta.categoryKey)!.push({
      meta: entry.meta,
      total: entry.total,
      due: entry.due,
      weak: entry.weak,
      learned: entry.learned,
      mastered: entry.mastered,
      avgRetention:
        entry.retCount > 0 ? Math.round(entry.retSum / entry.retCount) : null,
    });
  }

  return TAG_CATEGORY_ORDER.map((cat) => {
    const items = grouped.get(cat.key)!;
    if (cat.key === 'importance') {
      items.sort((a, b) => {
        const order = (s: string) =>
          s.includes('最重要') ? 0 : s.includes('重要') ? 1 : 2;
        return order(a.meta.displayLabel) - order(b.meta.displayLabel);
      });
    } else if (cat.key === 'lesson') {
      items.sort((a, b) =>
        a.meta.displayLabel.localeCompare(b.meta.displayLabel, 'ja', {
          numeric: true,
        })
      );
    } else {
      items.sort(
        (a, b) =>
          b.total - a.total ||
          a.meta.displayLabel.localeCompare(b.meta.displayLabel, 'ja')
      );
    }
    return {
      key: cat.key,
      label: cat.label,
      items,
    };
  }).filter((group) => group.items.length > 0);
}
