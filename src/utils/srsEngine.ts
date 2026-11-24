import type {
  DailyStudyLogsMap,
  Flashcard,
  SrsProgress,
  SrsProgressMap,
  SrsRating,
} from '../types/flashcards';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;

export function createInitialSrsProgress(cardId: string): SrsProgress {
  return {
    cardId,
    state: 'new',
    easeFactor: DEFAULT_EASE_FACTOR,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    dueAt: null,
    totalReviews: 0,
    correctReviews: 0,
  };
}

export function getSrsProgress(
  srsMap: SrsProgressMap,
  cardId: string
): SrsProgress {
  return srsMap[cardId] ?? createInitialSrsProgress(cardId);
}

/**
 * SM-2 inspired spaced repetition scheduler tuned for exam prep & long-term retention.
 * Rating: 1 = もう一度 (Again), 2 = 難しい (Hard), 3 = 普通 (Good), 4 = 簡単 (Easy)
 */
export function scheduleNextReview(
  current: SrsProgress,
  rating: SrsRating,
  nowMs: number = Date.now()
): { next: SrsProgress; intervalMs: number; requeueInSession: boolean } {
  const prevEase = current.easeFactor || DEFAULT_EASE_FACTOR;
  const totalReviews = current.totalReviews + 1;
  const correctReviews = current.correctReviews + (rating >= 2 ? 1 : 0);

  let state = current.state;
  let easeFactor = prevEase;
  let intervalDays = current.intervalDays;
  let repetitions = current.repetitions;
  let lapses = current.lapses;
  let intervalMs = DAY_MS;
  let requeueInSession = false;

  if (rating === 1) {
    // Again: reset short-term retention step and re-insert into active session queue
    requeueInSession = true;
    repetitions = 0;
    if (current.state === 'review' || current.state === 'relearning') {
      lapses += 1;
      state = 'relearning';
    } else {
      state = 'learning';
    }
    easeFactor = Math.max(MIN_EASE_FACTOR, Number((prevEase - 0.2).toFixed(2)));
    intervalMs = 10 * MINUTE_MS;
    intervalDays = Number((intervalMs / DAY_MS).toFixed(4));
  } else if (current.state === 'new' || current.state === 'learning' || current.state === 'relearning') {
    if (rating === 2) {
      // Hard on new/learning card: short review step
      state = current.state === 'relearning' ? 'relearning' : 'learning';
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((prevEase - 0.15).toFixed(2)));
      intervalMs = current.state === 'new' ? 12 * 60 * MINUTE_MS : 24 * 60 * MINUTE_MS;
      intervalDays = Number((intervalMs / DAY_MS).toFixed(2));
      repetitions = Math.max(1, repetitions);
    } else if (rating === 3) {
      // Good: graduate to 1 day (or 3 days if already repeated once)
      state = 'review';
      repetitions = Math.max(1, repetitions + 1);
      intervalDays = repetitions === 1 ? 1 : 3;
      intervalMs = intervalDays * DAY_MS;
    } else {
      // Easy: graduate immediately with bonus interval
      state = 'review';
      repetitions = Math.max(2, repetitions + 1);
      easeFactor = Number((prevEase + 0.15).toFixed(2));
      intervalDays = current.state === 'relearning' ? 3 : 4;
      intervalMs = intervalDays * DAY_MS;
    }
  } else {
    // Mature / Review card
    if (rating === 2) {
      // Hard
      easeFactor = Math.max(MIN_EASE_FACTOR, Number((prevEase - 0.15).toFixed(2)));
      intervalDays = Math.max(1, Math.round(Math.max(1, current.intervalDays) * 1.2));
      repetitions += 1;
      intervalMs = intervalDays * DAY_MS;
    } else if (rating === 3) {
      // Good
      repetitions += 1;
      if (repetitions === 1) {
        intervalDays = 1;
      } else if (repetitions === 2) {
        intervalDays = 4;
      } else {
        intervalDays = Math.max(
          Math.round(current.intervalDays) + 1,
          Math.round(current.intervalDays * easeFactor)
        );
      }
      intervalMs = intervalDays * DAY_MS;
    } else {
      // Easy
      repetitions += 1;
      easeFactor = Number((prevEase + 0.15).toFixed(2));
      const base =
        repetitions === 1 ? 4 : Math.max(4, current.intervalDays * easeFactor * 1.3);
      intervalDays = Math.max(Math.round(current.intervalDays) + 2, Math.round(base));
      intervalMs = intervalDays * DAY_MS;
    }
  }

  // Cap interval at 365 days
  if (intervalDays > 365) {
    intervalDays = 365;
    intervalMs = 365 * DAY_MS;
  }

  const next: SrsProgress = {
    cardId: current.cardId,
    state,
    easeFactor,
    intervalDays,
    repetitions,
    lapses,
    lastReviewedAt: nowMs,
    dueAt: nowMs + intervalMs,
    totalReviews,
    correctReviews,
  };

  return { next, intervalMs, requeueInSession };
}

export function formatIntervalLabel(intervalMs: number): string {
  const minutes = Math.round(intervalMs / MINUTE_MS);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}分後`;
  }
  const hours = intervalMs / (60 * MINUTE_MS);
  if (hours < 24) {
    return `${Math.round(hours)}時間後`;
  }
  const days = intervalMs / DAY_MS;
  if (days < 14) {
    return `${Math.round(days)}日後`;
  }
  if (days < 60) {
    const weeks = days / 7;
    return `${weeks >= 4 ? Math.round(weeks) : weeks.toFixed(1)}週間後`;
  }
  const months = days / 30;
  return `${months.toFixed(1)}ヶ月後`;
}

export function previewRatingIntervals(
  current: SrsProgress,
  nowMs: number = Date.now()
): Record<SrsRating, string> {
  return {
    1: formatIntervalLabel(scheduleNextReview(current, 1, nowMs).intervalMs),
    2: formatIntervalLabel(scheduleNextReview(current, 2, nowMs).intervalMs),
    3: formatIntervalLabel(scheduleNextReview(current, 3, nowMs).intervalMs),
    4: formatIntervalLabel(scheduleNextReview(current, 4, nowMs).intervalMs),
  };
}

/**
 * Computes Ebbinghaus memory stability (days until retention drops to ~37%)
 * and estimated current recall probability R(t) = exp(-t / S) in [0, 100].
 */
export function getMemoryStabilityDays(progress: SrsProgress): number {
  if (progress.state === 'new' || !progress.lastReviewedAt) return 0;
  const interval = Math.max(0.15, progress.intervalDays);
  // Target retention at due date is ~85%, so exp(-interval / S) = 0.85 => S ≈ interval / 0.1625
  // Modulate gently with easeFactor so harder cards decay slightly faster.
  const easeRatio = progress.easeFactor / DEFAULT_EASE_FACTOR;
  return Math.max(0.25, (interval / 0.18) * easeRatio);
}

export function calculateRetentionPercent(
  progress: SrsProgress,
  nowMs: number = Date.now()
): number | null {
  if (progress.state === 'new' || !progress.lastReviewedAt) return null;
  const stability = getMemoryStabilityDays(progress);
  const elapsedDays = Math.max(0, (nowMs - progress.lastReviewedAt) / DAY_MS);
  const retention = Math.exp(-elapsedDays / stability);
  return Math.max(5, Math.min(100, Math.round(retention * 100)));
}

export function isCardDue(
  progress: SrsProgress,
  nowMs: number = Date.now()
): boolean {
  if (progress.state === 'new') return false;
  if (progress.dueAt === null) return false;
  return progress.dueAt <= nowMs;
}

export function isCardMastered(progress: SrsProgress): boolean {
  return progress.state === 'review' && progress.intervalDays >= 14;
}

export function isCardWeak(
  progress: SrsProgress,
  nowMs: number = Date.now()
): boolean {
  if (progress.totalReviews === 0) return false;
  const accuracy = progress.correctReviews / progress.totalReviews;
  const retention = calculateRetentionPercent(progress, nowMs);
  return (
    progress.lapses >= 1 ||
    progress.state === 'relearning' ||
    accuracy < 0.72 ||
    progress.easeFactor < 2.2 ||
    (retention !== null && retention < 70)
  );
}

export function getCardStatusLabel(
  progress: SrsProgress,
  nowMs: number = Date.now()
): { label: string; tone: 'neutral' | 'due' | 'learning' | 'review' | 'mastered' } {
  if (progress.state === 'new') {
    return { label: '未学習', tone: 'neutral' };
  }
  if (isCardDue(progress, nowMs)) {
    return { label: '復習待ち', tone: 'due' };
  }
  if (progress.state === 'learning' || progress.state === 'relearning') {
    return { label: '学習中', tone: 'learning' };
  }
  if (isCardMastered(progress)) {
    return { label: '長期定着', tone: 'mastered' };
  }
  return { label: '定着中', tone: 'review' };
}

export function formatDueRelative(
  dueAt: number | null,
  nowMs: number = Date.now()
): string {
  if (dueAt === null) return '未設定';
  const diff = dueAt - nowMs;
  if (diff <= 0) {
    const overdueDays = Math.floor(Math.abs(diff) / DAY_MS);
    if (overdueDays >= 1) return `${overdueDays}日超過`;
    return '今すぐ復習';
  }
  return formatIntervalLabel(diff);
}

export function getLocalDateKey(timestampMs: number = Date.now()): string {
  const d = new Date(timestampMs);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeStudyStreak(
  logsMap: DailyStudyLogsMap,
  nowMs: number = Date.now()
): number {
  let streak = 0;
  const todayKey = getLocalDateKey(nowMs);
  const yesterdayKey = getLocalDateKey(nowMs - DAY_MS);

  let cursorMs = nowMs;
  if (!logsMap[todayKey]?.reviews) {
    if (!logsMap[yesterdayKey]?.reviews) {
      return 0;
    }
    cursorMs = nowMs - DAY_MS;
  }

  while (true) {
    const key = getLocalDateKey(cursorMs);
    if (logsMap[key]?.reviews && logsMap[key].reviews > 0) {
      streak += 1;
      cursorMs -= DAY_MS;
    } else {
      break;
    }
  }
  return streak;
}

export interface ForecastDayItem {
  dateKey: string;
  label: string;
  dueCount: number;
  isToday: boolean;
}

export function build14DayForecast(
  cards: Flashcard[],
  srsMap: SrsProgressMap,
  nowMs: number = Date.now()
): ForecastDayItem[] {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayStartMs = startOfToday.getTime();

  const items: ForecastDayItem[] = [];
  for (let i = 0; i < 14; i++) {
    const dayMs = todayStartMs + i * DAY_MS;
    const d = new Date(dayMs);
    const label = i === 0 ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`;
    items.push({
      dateKey: getLocalDateKey(dayMs),
      label,
      dueCount: 0,
      isToday: i === 0,
    });
  }

  for (const card of cards) {
    if (card.suspended) continue;
    const progress = srsMap[card.id];
    if (!progress || progress.state === 'new' || progress.dueAt === null) continue;

    if (progress.dueAt <= todayStartMs + DAY_MS - 1) {
      items[0].dueCount += 1;
    } else {
      const diffDays = Math.floor((progress.dueAt - todayStartMs) / DAY_MS);
      if (diffDays >= 1 && diffDays < 14) {
        items[diffDays].dueCount += 1;
      }
    }
  }

  return items;
}

/**
 * Normalizes Japanese history answers for forgiving typing check.
 */
function normalizeAnswerText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　、。,.・「」『』"']/g, '')
    .replace(/[＝=―ー−-]/g, '');
}

export function evaluateTypedAnswer(
  userInput: string,
  expectedBack: string
): { verdict: 'exact' | 'partial' | 'mismatch'; coreExpected: string } {
  const trimmed = userInput.trim();
  const coreExpected = expectedBack
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();

  if (!trimmed) {
    return { verdict: 'mismatch', coreExpected: coreExpected || expectedBack };
  }

  const normInput = normalizeAnswerText(trimmed);
  const normFull = normalizeAnswerText(expectedBack);
  const normCore = normalizeAnswerText(coreExpected || expectedBack);

  if (!normInput) {
    return { verdict: 'mismatch', coreExpected: coreExpected || expectedBack };
  }

  if (normInput === normFull || normInput === normCore) {
    return { verdict: 'exact', coreExpected: coreExpected || expectedBack };
  }

  // Check if multiple answers separated by 、 or , are partially matched
  if (
    normInput.length >= 2 &&
    (normFull.includes(normInput) || normCore.includes(normInput) || normInput.includes(normCore))
  ) {
    return { verdict: 'partial', coreExpected: coreExpected || expectedBack };
  }

  return { verdict: 'mismatch', coreExpected: coreExpected || expectedBack };
}
