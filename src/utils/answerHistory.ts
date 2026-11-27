import type {
  AnswerHistoryEntry,
  SrsRating,
  StudyMode,
} from '../types/flashcards';
import { getLocalDateKey } from './srsEngine';

export const MAX_ANSWER_HISTORY_ENTRIES = 2000;

export type HistoryRatingFilter = 'all' | 'again' | 'hard' | 'good' | 'easy';

export interface HistoryFilterOptions {
  scopeId?: string; // 'all' or specific scopeId
  ratingFilter?: HistoryRatingFilter;
  modeFilter?: 'all' | StudyMode;
  search?: string;
}

export interface HistorySummary {
  total: number;
  correctCount: number;
  againCount: number;
  accuracyPercent: number | null;
  uniqueCardIds: string[];
  weakCardIds: string[];
}

export interface HistoryDateGroup {
  dateKey: string;
  label: string;
  entries: AnswerHistoryEntry[];
}

export function appendAnswerHistory(
  history: AnswerHistoryEntry[],
  entry: AnswerHistoryEntry,
  maxEntries: number = MAX_ANSWER_HISTORY_ENTRIES
): AnswerHistoryEntry[] {
  const next = [entry, ...history];
  return next.length > maxEntries ? next.slice(0, maxEntries) : next;
}

export function removeAnswerHistoryEntry(
  history: AnswerHistoryEntry[],
  entryId: string
): AnswerHistoryEntry[] {
  return history.filter((item) => item.id !== entryId);
}

const RATING_FILTER_MAP: Record<Exclude<HistoryRatingFilter, 'all'>, SrsRating> = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
};

export function filterAnswerHistory(
  history: AnswerHistoryEntry[],
  options: HistoryFilterOptions
): AnswerHistoryEntry[] {
  const {
    scopeId = 'all',
    ratingFilter = 'all',
    modeFilter = 'all',
    search = '',
  } = options;

  const query = search.trim().toLowerCase();
  const targetRating =
    ratingFilter === 'all' ? null : RATING_FILTER_MAP[ratingFilter];

  return history.filter((entry) => {
    if (scopeId !== 'all' && entry.scopeId !== scopeId) {
      return false;
    }
    if (targetRating !== null && entry.rating !== targetRating) {
      return false;
    }
    if (modeFilter !== 'all' && entry.mode !== modeFilter) {
      return false;
    }
    if (!query) return true;

    const haystack = [
      `no.${entry.cardNumber}`,
      String(entry.cardNumber),
      entry.unit,
      entry.front,
      entry.back,
      entry.typedAnswer ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function computeHistorySummary(
  entries: AnswerHistoryEntry[]
): HistorySummary {
  let correctCount = 0;
  let againCount = 0;
  const uniqueCardIds: string[] = [];
  const seenUnique = new Set<string>();
  const weakCardIds: string[] = [];
  const seenWeak = new Set<string>();

  for (const entry of entries) {
    if (entry.rating >= 2) {
      correctCount += 1;
    } else {
      againCount += 1;
      if (!seenWeak.has(entry.cardId)) {
        seenWeak.add(entry.cardId);
        weakCardIds.push(entry.cardId);
      }
    }

    if (!seenUnique.has(entry.cardId)) {
      seenUnique.add(entry.cardId);
      uniqueCardIds.push(entry.cardId);
    }
  }

  const total = entries.length;
  return {
    total,
    correctCount,
    againCount,
    accuracyPercent: total > 0 ? Math.round((correctCount / total) * 100) : null,
    uniqueCardIds,
    weakCardIds,
  };
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function formatHistoryDateHeading(
  dateKey: string,
  nowMs: number = Date.now()
): string {
  const todayKey = getLocalDateKey(nowMs);
  if (dateKey === todayKey) return '今日';

  const yesterdayKey = getLocalDateKey(nowMs - 24 * 60 * 60 * 1000);
  if (dateKey === yesterdayKey) return '昨日';

  const parts = dateKey.split('-').map((v) => Number.parseInt(v, 10));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const [year, month, day] = parts;
    const d = new Date(year, month - 1, day);
    const weekday = WEEKDAYS_JA[d.getDay()] ?? '';
    const nowYear = new Date(nowMs).getFullYear();
    const yearPrefix = year !== nowYear ? `${year}年` : '';
    return `${yearPrefix}${month}月${day}日（${weekday}）`;
  }

  return dateKey;
}

export function formatHistoryTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function groupHistoryByDate(
  entries: AnswerHistoryEntry[],
  nowMs: number = Date.now()
): HistoryDateGroup[] {
  const groups: HistoryDateGroup[] = [];
  const byKey = new Map<string, HistoryDateGroup>();

  for (const entry of entries) {
    const dateKey = getLocalDateKey(entry.answeredAt);
    let group = byKey.get(dateKey);
    if (!group) {
      group = {
        dateKey,
        label: formatHistoryDateHeading(dateKey, nowMs),
        entries: [],
      };
      byKey.set(dateKey, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return groups;
}

export function getCardRecentHistory(
  history: AnswerHistoryEntry[],
  cardId: string,
  limit: number = 5
): AnswerHistoryEntry[] {
  const matched: AnswerHistoryEntry[] = [];
  for (const entry of history) {
    if (entry.cardId === cardId) {
      matched.push(entry);
      if (matched.length >= limit) break;
    }
  }
  return matched;
}
