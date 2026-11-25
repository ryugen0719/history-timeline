import type {
  Flashcard,
  PersistedStudySession,
  SrsRating,
} from '../types/flashcards';

export type TypingVerdict = 'exact' | 'partial' | 'mismatch';
export type RedSheetFilter = 'all' | 'unrated' | 'again';

/**
 * Recommends an SRS rating after typing check so users can press Enter
 * to flow smoothly through typing sessions without lifting hands from keyboard.
 */
export function getRecommendedRatingForTyping(verdict: TypingVerdict): SrsRating {
  if (verdict === 'exact') return 3;
  if (verdict === 'partial') return 2;
  return 1;
}

/**
 * Skips or defers the current card in a study queue without mutating SRS progress.
 * - 'defer': moves the current card to the end of the remaining queue so it returns later.
 * - 'next': moves cursor forward by 1 card (clamped to last card).
 */
export function skipCardInQueue(
  queueIds: string[],
  currentIndex: number,
  mode: 'defer' | 'next' = 'defer'
): { queueIds: string[]; nextIndex: number } {
  if (queueIds.length === 0) {
    return { queueIds: [], nextIndex: 0 };
  }

  const safeIdx = Math.max(0, Math.min(currentIndex, queueIds.length - 1));

  if (mode === 'next') {
    return {
      queueIds: [...queueIds],
      nextIndex: Math.min(queueIds.length - 1, safeIdx + 1),
    };
  }

  // Defer: if already at the last card, nothing ahead to swap with
  if (safeIdx >= queueIds.length - 1) {
    return {
      queueIds: [...queueIds],
      nextIndex: safeIdx,
    };
  }

  const deferredId = queueIds[safeIdx];
  const nextQueue = [
    ...queueIds.slice(0, safeIdx),
    ...queueIds.slice(safeIdx + 1),
    deferredId,
  ];
  return {
    queueIds: nextQueue,
    nextIndex: safeIdx,
  };
}

/**
 * Validates and cleans a persisted study session against currently existing cards.
 * Returns null if the session is empty or already completed.
 */
export function reconcilePersistedSession(
  session: PersistedStudySession | null,
  validCardIds: Set<string>
): PersistedStudySession | null {
  if (!session || !Array.isArray(session.queueIds) || session.queueIds.length === 0) {
    return null;
  }

  const filteredQueue: string[] = [];
  let removedBeforeCursor = 0;

  for (let i = 0; i < session.queueIds.length; i++) {
    const id = session.queueIds[i];
    if (validCardIds.has(id)) {
      filteredQueue.push(id);
    } else if (i < session.currentIndex) {
      removedBeforeCursor += 1;
    }
  }

  if (filteredQueue.length === 0) {
    return null;
  }

  const nextIndex = Math.max(0, session.currentIndex - removedBeforeCursor);

  if (session.config.mode !== 'redsheet' && nextIndex >= filteredQueue.length) {
    return null;
  }

  const cleanedAgain = (session.againCardIds ?? []).filter((id) =>
    validCardIds.has(id)
  );
  const cleanedRedSheet: Record<string, SrsRating> = {};
  if (session.redSheetRated) {
    for (const [id, rating] of Object.entries(session.redSheetRated)) {
      if (validCardIds.has(id)) {
        cleanedRedSheet[id] = rating;
      }
    }
  }

  return {
    ...session,
    queueIds: filteredQueue,
    currentIndex: Math.min(nextIndex, filteredQueue.length - 1),
    againCardIds: cleanedAgain,
    redSheetRated: cleanedRedSheet,
  };
}

export function uniqueCardsFromQueueIds(
  queueIds: string[],
  allCardsMap: Record<string, Flashcard>
): Flashcard[] {
  const seen = new Set<string>();
  const result: Flashcard[] = [];
  for (const id of queueIds) {
    if (seen.has(id)) continue;
    const card = allCardsMap[id];
    if (!card) continue;
    seen.add(id);
    result.push(card);
  }
  return result;
}

export function filterRedSheetCards(
  cards: Flashcard[],
  ratedMap: Record<string, SrsRating>,
  filter: RedSheetFilter
): Flashcard[] {
  if (filter === 'unrated') {
    return cards.filter((c) => ratedMap[c.id] === undefined);
  }
  if (filter === 'again') {
    return cards.filter((c) => ratedMap[c.id] === 1);
  }
  return cards;
}

export function computeRedSheetStats(
  cards: Flashcard[],
  ratedMap: Record<string, SrsRating>
): { total: number; rated: number; again: number; remembered: number } {
  let rated = 0;
  let again = 0;
  let remembered = 0;
  for (const c of cards) {
    const r = ratedMap[c.id];
    if (r !== undefined) {
      rated += 1;
      if (r === 1) again += 1;
      else remembered += 1;
    }
  }
  return {
    total: cards.length,
    rated,
    again,
    remembered,
  };
}

export function classifySwipeGesture(
  dx: number,
  dy: number,
  thresholdPx: number = 68
): 'left' | 'right' | null {
  if (Math.abs(dx) >= thresholdPx && Math.abs(dx) > Math.abs(dy) * 1.35) {
    return dx < 0 ? 'left' : 'right';
  }
  return null;
}
