import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import {
  buildInitialTerm3Flashcards,
  INITIAL_EXAM_SCOPES,
  INITIAL_FLASHCARDS,
  TERM3_SCOPE_ID,
} from '../../data/initialFlashcards';
import type {
  AnswerHistoryEntry,
  DailyStudyLogsMap,
  ExamScope,
  Flashcard,
  FlashcardBackupPayload,
  FlashcardSubView,
  HubLaunchPrefs,
  PersistedStudySession,
  RateCardMeta,
  SrsProgress,
  SrsProgressMap,
  SrsRating,
  StudySessionConfig,
} from '../../types/flashcards';
import {
  appendAnswerHistory,
  removeAnswerHistoryEntry,
} from '../../utils/answerHistory';
import { buildStudyQueue } from '../../utils/flashcardFilter';
import { exportFlashcardsToCsv } from '../../utils/flashcardParser';
import { reconcilePersistedSession } from '../../utils/studySession';
import {
  computeStudyStreak,
  getLocalDateKey,
  getSrsProgress,
  isCardDue,
  scheduleNextReview,
} from '../../utils/srsEngine';
import { BulkImportModal } from './BulkImportModal';
import { CardEditorModal } from './CardEditorModal';
import { CardManageView } from './CardManageView';
import { FlashcardHubView } from './FlashcardHubView';
import { ForgettingCurveAnalyticsView } from './ForgettingCurveAnalyticsView';
import { ScopeManagerModal } from './ScopeManagerModal';
import { StudyStageView } from './StudyStageView';

const STORAGE_KEY_SCOPES = 'chrononote_flashcards_scopes_v1';
const STORAGE_KEY_CARDS = 'chrononote_flashcards_cards_v1';
const STORAGE_KEY_SRS = 'chrononote_flashcards_srs_v1';
const STORAGE_KEY_LOGS = 'chrononote_flashcards_logs_v1';
const STORAGE_KEY_HISTORY = 'chrononote_flashcards_history_v1';
const STORAGE_KEY_SESSION = 'chrononote_flashcards_active_session_v1';
const STORAGE_KEY_HUB_PREFS = 'chrononote_flashcards_hub_prefs_v1';

const DEFAULT_HUB_PREFS: HubLaunchPrefs = {
  mode: 'flip',
  orderMode: 'unit',
  showCardAttemptDots: true,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const UNIT_23_NAME = '23. 日清戦争';
const UNIT_24_NAME = '24. 日露戦争から韓国併合へ';
const TAG_LESSON_23 = '授業_23_日清戦争';

function deduplicateStoredTerm3Data(
  scopes: ExamScope[],
  cards: Flashcard[],
  srsMap: SrsProgressMap
): {
  scopes: ExamScope[];
  cards: Flashcard[];
  srsMap: SrsProgressMap;
  removedCount: number;
} {
  const lesson23ByKey = new Map<string, Flashcard>();
  for (const card of cards) {
    if (card.scopeId === TERM3_SCOPE_ID && card.unit === UNIT_23_NAME) {
      lesson23ByKey.set(`${card.front}\u0000${card.back}`, card);
    }
  }

  const dupToOriginal = new Map<string, Flashcard>();
  for (const card of cards) {
    if (
      card.scopeId === TERM3_SCOPE_ID &&
      card.unit === UNIT_24_NAME &&
      card.tags.includes(TAG_LESSON_23)
    ) {
      const original = lesson23ByKey.get(`${card.front}\u0000${card.back}`);
      if (original && original.id !== card.id) {
        dupToOriginal.set(card.id, original);
      }
    }
  }

  const nextScopes = scopes.map((scope) =>
    scope.id === TERM3_SCOPE_ID && scope.description.includes('全14単元・310問')
      ? {
          ...scope,
          description: scope.description.replace(
            '全14単元・310問',
            `全14単元・${INITIAL_FLASHCARDS.length}問`
          ),
        }
      : scope
  );

  if (dupToOriginal.size === 0) {
    return { scopes: nextScopes, cards, srsMap, removedCount: 0 };
  }

  const starredOriginalIds = new Set<string>();
  const nextSrsMap: SrsProgressMap = { ...srsMap };

  for (const card of cards) {
    const original = dupToOriginal.get(card.id);
    if (!original) continue;

    if (card.starred) {
      starredOriginalIds.add(original.id);
    }

    const dupProgress = nextSrsMap[card.id];
    if (dupProgress) {
      const origProgress = nextSrsMap[original.id];
      if (!origProgress || dupProgress.totalReviews > origProgress.totalReviews) {
        nextSrsMap[original.id] = {
          ...dupProgress,
          cardId: original.id,
        };
      }
      delete nextSrsMap[card.id];
    }
  }

  let term3Seq = 1;
  const nextCards: Flashcard[] = [];
  for (const card of cards) {
    if (dupToOriginal.has(card.id)) continue;
    if (card.scopeId === TERM3_SCOPE_ID) {
      nextCards.push({
        ...card,
        number: term3Seq++,
        starred: card.starred || starredOriginalIds.has(card.id),
      });
    } else {
      nextCards.push(card);
    }
  }

  return {
    scopes: nextScopes,
    cards: nextCards,
    srsMap: nextSrsMap,
    removedCount: dupToOriginal.size,
  };
}

function loadInitialFlashcardState() {
  const savedScopes = loadFromStorage<ExamScope[] | null>(STORAGE_KEY_SCOPES, null);
  const savedCards = loadFromStorage<Flashcard[] | null>(STORAGE_KEY_CARDS, null);
  const savedSrs = loadFromStorage<SrsProgressMap>(STORAGE_KEY_SRS, {});

  const baseScopes =
    savedScopes && savedScopes.length > 0 ? savedScopes : INITIAL_EXAM_SCOPES;
  const baseCards =
    savedCards && savedCards.length > 0 ? savedCards : INITIAL_FLASHCARDS;

  return deduplicateStoredTerm3Data(baseScopes, baseCards, savedSrs);
}

export function FlashcardWorkspace() {
  const [initialData] = useState(() => loadInitialFlashcardState());
  const [scopes, setScopes] = useState<ExamScope[]>(initialData.scopes);
  const [cards, setCards] = useState<Flashcard[]>(initialData.cards);
  const [srsMap, setSrsMap] = useState<SrsProgressMap>(initialData.srsMap);

  const [dailyLogs, setDailyLogs] = useState<DailyStudyLogsMap>(() =>
    loadFromStorage<DailyStudyLogsMap>(STORAGE_KEY_LOGS, {})
  );

  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>(() => {
    const saved = loadFromStorage<unknown>(STORAGE_KEY_HISTORY, []);
    return Array.isArray(saved) ? (saved as AnswerHistoryEntry[]) : [];
  });

  const [subView, setSubView] = useState<FlashcardSubView>('hub');
  const [activeScopeId, setActiveScopeId] = useState<string>(
    () => initialData.scopes[0]?.id ?? TERM3_SCOPE_ID
  );

  const [hubPrefs, setHubPrefs] = useState<HubLaunchPrefs>(() => {
    const saved = loadFromStorage<Partial<HubLaunchPrefs> | null>(
      STORAGE_KEY_HUB_PREFS,
      null
    );
    return {
      mode:
        saved?.mode === 'typing' || saved?.mode === 'redsheet' || saved?.mode === 'flip'
          ? saved.mode
          : DEFAULT_HUB_PREFS.mode,
      orderMode:
        saved?.orderMode === 'shuffle' || saved?.orderMode === 'unit'
          ? saved.orderMode
          : DEFAULT_HUB_PREFS.orderMode,
      showCardAttemptDots:
        typeof saved?.showCardAttemptDots === 'boolean'
          ? saved.showCardAttemptDots
          : DEFAULT_HUB_PREFS.showCardAttemptDots,
    };
  });

  const [savedSession, setSavedSession] = useState<PersistedStudySession | null>(() => {
    const raw = loadFromStorage<PersistedStudySession | null>(
      STORAGE_KEY_SESSION,
      null
    );
    const validIds = new Set(initialData.cards.map((c) => c.id));
    return reconcilePersistedSession(raw, validIds);
  });

  const [activeSession, setActiveSession] = useState<PersistedStudySession | null>(null);
  const [isStudyMobileDockActive, setIsStudyMobileDockActive] = useState(false);

  // Modals
  const [isCardEditorOpen, setIsCardEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isScopeManagerOpen, setIsScopeManagerOpen] = useState(false);

  // Subtle toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (subView !== 'study') {
      setIsStudyMobileDockActive(false);
    }
  }, [subView]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SCOPES, JSON.stringify(scopes));
    } catch {
      // Ignore storage quota errors
    }
  }, [scopes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
    } catch {
      // Ignore storage quota errors
    }
  }, [cards]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SRS, JSON.stringify(srsMap));
    } catch {
      // Ignore storage quota errors
    }
  }, [srsMap]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(dailyLogs));
    } catch {
      // Ignore storage quota errors
    }
  }, [dailyLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(answerHistory));
    } catch {
      // Ignore storage quota errors
    }
  }, [answerHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HUB_PREFS, JSON.stringify(hubPrefs));
    } catch {
      // Ignore storage quota errors
    }
  }, [hubPrefs]);

  useEffect(() => {
    try {
      if (savedSession) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(savedSession));
      } else {
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [savedSession]);

  const allCardsMap = useMemo(() => {
    const map: Record<string, Flashcard> = {};
    for (const c of cards) {
      map[c.id] = c;
    }
    return map;
  }, [cards]);

  const cardCountsByScope = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      counts[c.scopeId] = (counts[c.scopeId] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

  const existingChapters = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      if (c.chapter) set.add(c.chapter);
    }
    return Array.from(set);
  }, [cards]);

  const existingUnits = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      if (c.unit) set.add(c.unit);
    }
    return Array.from(set);
  }, [cards]);

  const suggestedTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cards) {
      for (const t of c.tags) {
        if (!t.startsWith('授業_')) {
          counts.set(t, (counts.get(t) ?? 0) + 1);
        }
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [cards]);

  const nextNumber = useMemo(() => {
    const relevant =
      activeScopeId === 'all'
        ? cards
        : cards.filter((c) => c.scopeId === activeScopeId);
    const maxNum = relevant.reduce((max, c) => Math.max(max, c.number), 0);
    return maxNum + 1;
  }, [cards, activeScopeId]);

  const streakDays = useMemo(() => computeStudyStreak(dailyLogs), [dailyLogs]);
  const todayKey = getLocalDateKey();
  const todayReviews = dailyLogs[todayKey]?.reviews ?? 0;

  const totalDueInActiveScope = useMemo(() => {
    const now = Date.now();
    return cards.filter(
      (c) =>
        !c.suspended &&
        (activeScopeId === 'all' || c.scopeId === activeScopeId) &&
        isCardDue(getSrsProgress(srsMap, c.id), now)
    ).length;
  }, [cards, activeScopeId, srsMap]);

  const reconciledSavedSession = useMemo(() => {
    const validIds = new Set(cards.map((c) => c.id));
    return reconcilePersistedSession(savedSession, validIds);
  }, [savedSession, cards]);

  const handleLaunchSession = useCallback(
    (config: StudySessionConfig) => {
      const queue = buildStudyQueue(cards, srsMap, config, Date.now());
      const now = Date.now();
      const nextSession: PersistedStudySession = {
        sessionId: `sess-${now}-${Math.random().toString(36).slice(2, 6)}`,
        config,
        queueIds: queue.map((c) => c.id),
        currentIndex: 0,
        ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        againCardIds: [],
        redSheetRated: {},
        updatedAt: now,
      };
      setActiveSession(nextSession);
      if (nextSession.queueIds.length > 0) {
        setSavedSession(nextSession);
      }
      setSubView('study');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [cards, srsMap]
  );

  const handleResumeSavedSession = useCallback(() => {
    if (!reconciledSavedSession) return;
    setActiveSession(reconciledSavedSession);
    setSubView('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [reconciledSavedSession]);

  const handleDiscardSavedSession = useCallback(() => {
    setSavedSession(null);
    showToast('前回の学習セッションをクリアしました。');
  }, [showToast]);

  const handleSyncActiveSession = useCallback(
    (nextSession: PersistedStudySession | null) => {
      setSavedSession(nextSession);
    },
    []
  );

  const handleLaunchCustomCardIds = useCallback(
    (cardIds: string[], label: string) => {
      const uniqueValidIds: string[] = [];
      const seen = new Set<string>();
      for (const id of cardIds) {
        if (!seen.has(id) && allCardsMap[id]) {
          seen.add(id);
          uniqueValidIds.push(id);
        }
      }
      if (uniqueValidIds.length === 0) {
        showToast('対象の問題が見つかりませんでした。');
        return;
      }
      const now = Date.now();
      const config: StudySessionConfig = {
        scopeId: activeScopeId,
        chapter: 'all',
        unit: 'all',
        selectedTags: [],
        tagMatchMode: 'and',
        filterPreset: 'all',
        orderMode: 'unit',
        swapFrontBack: false,
        recordToSrs: true,
        mode: hubPrefs.mode,
        label,
      };
      const nextSession: PersistedStudySession = {
        sessionId: `sess-${now}-${Math.random().toString(36).slice(2, 6)}`,
        config,
        queueIds: uniqueValidIds,
        currentIndex: 0,
        ratingCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
        againCardIds: [],
        redSheetRated: {},
        updatedAt: now,
      };
      setActiveSession(nextSession);
      setSavedSession(nextSession);
      setSubView('study');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [allCardsMap, activeScopeId, hubPrefs.mode, showToast]
  );

  const handleClearAnswerHistory = useCallback(() => {
    setAnswerHistory([]);
    showToast('回答履歴をクリアしました。');
  }, [showToast]);

  const handleRateCard = useCallback(
    (
      cardId: string,
      rating: SrsRating,
      recordToSrs: boolean,
      meta?: RateCardMeta
    ) => {
      const previous = getSrsProgress(srsMap, cardId);
      const nowMs = Date.now();
      const { next, requeueInSession } = scheduleNextReview(previous, rating, nowMs);

      if (recordToSrs) {
        setSrsMap((prev) => ({
          ...prev,
          [cardId]: next,
        }));

        const key = getLocalDateKey(nowMs);
        setDailyLogs((prev) => {
          const existing = prev[key] ?? {
            date: key,
            reviews: 0,
            correct: 0,
            newStudied: 0,
            againCount: 0,
          };
          return {
            ...prev,
            [key]: {
              date: key,
              reviews: existing.reviews + 1,
              correct: existing.correct + (rating >= 2 ? 1 : 0),
              newStudied:
                existing.newStudied + (previous.state === 'new' ? 1 : 0),
              againCount: existing.againCount + (rating === 1 ? 1 : 0),
            },
          };
        });
      }

      const card = allCardsMap[cardId];
      let historyEntryId: string | undefined;
      if (card) {
        historyEntryId = `hist-${nowMs}-${Math.random().toString(36).slice(2, 7)}`;
        const entry: AnswerHistoryEntry = {
          id: historyEntryId,
          cardId: card.id,
          scopeId: card.scopeId,
          cardNumber: card.number,
          unit: card.unit,
          front: card.front,
          back: card.back,
          rating,
          mode: meta?.mode ?? 'flip',
          typedAnswer: meta?.typedAnswer,
          typingVerdict: meta?.typingVerdict,
          recordedToSrs: recordToSrs,
          answeredAt: nowMs,
        };
        setAnswerHistory((prev) => appendAnswerHistory(prev, entry));
      }

      return { previous, requeueInSession, historyEntryId };
    },
    [srsMap, allCardsMap]
  );

  const handleUndoCardRate = useCallback(
    (
      cardId: string,
      previous: SrsProgress,
      wasRecorded: boolean,
      historyEntryId?: string
    ) => {
      if (historyEntryId) {
        setAnswerHistory((prev) => removeAnswerHistoryEntry(prev, historyEntryId));
      }
      if (!wasRecorded) return;
      setSrsMap((prev) => ({
        ...prev,
        [cardId]: previous,
      }));
      const key = getLocalDateKey();
      setDailyLogs((prev) => {
        const existing = prev[key];
        if (!existing) return prev;
        return {
          ...prev,
          [key]: {
            ...existing,
            reviews: Math.max(0, existing.reviews - 1),
          },
        };
      });
    },
    []
  );

  const handleToggleStar = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, starred: !c.starred } : c))
    );
  }, []);

  const handleToggleSuspend = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, suspended: !c.suspended } : c))
    );
  }, []);

  const handleResetCardSrs = useCallback(
    (cardId: string) => {
      setSrsMap((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      showToast('カードの学習履歴をリセットしました。');
    },
    [showToast]
  );

  const handleSaveCard = useCallback(
    (payload: {
      id?: string;
      scopeId: string;
      number: number;
      chapter: string;
      unit: string;
      front: string;
      back: string;
      tags: string[];
      note?: string;
    }) => {
      const now = Date.now();
      if (payload.id) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === payload.id
              ? {
                  ...c,
                  scopeId: payload.scopeId,
                  number: payload.number,
                  chapter: payload.chapter,
                  unit: payload.unit,
                  front: payload.front,
                  back: payload.back,
                  tags: payload.tags,
                  note: payload.note,
                  updatedAt: now,
                }
              : c
          )
        );
        showToast(`問題 No.${payload.number} を更新しました。`);
      } else {
        const newCard: Flashcard = {
          id: `custom-${now}-${Math.random().toString(36).slice(2, 7)}`,
          scopeId: payload.scopeId,
          number: payload.number,
          deckPath: `*歴史総合::${payload.chapter}::${payload.unit}`,
          chapter: payload.chapter,
          unit: payload.unit,
          front: payload.front,
          back: payload.back,
          tags: payload.tags,
          note: payload.note,
          starred: false,
          suspended: false,
          createdAt: now,
          updatedAt: now,
        };
        setCards((prev) => [...prev, newCard]);
        showToast(`問題 No.${payload.number} を追加しました。`);
      }
    },
    [showToast]
  );

  const handleDeleteCard = useCallback(
    (cardId: string) => {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setSrsMap((prev) => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
      setActiveSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          queueIds: prev.queueIds.filter((id) => id !== cardId),
        };
      });
      showToast('問題を削除しました。');
    },
    [showToast]
  );

  const handleImportCards = useCallback(
    (payload: { cards: Flashcard[]; newScope?: ExamScope }) => {
      if (payload.newScope) {
        setScopes((prev) => [...prev, payload.newScope!]);
        setActiveScopeId(payload.newScope.id);
      }
      setCards((prev) => [...prev, ...payload.cards]);
      showToast(
        payload.newScope
          ? `「${payload.newScope.name}」に ${payload.cards.length} 問を追加しました。`
          : `${payload.cards.length} 問を一括追加しました。`
      );
    },
    [showToast]
  );

  const handleRestoreBackup = useCallback(
    (backup: FlashcardBackupPayload) => {
      const cleaned = deduplicateStoredTerm3Data(
        backup.scopes && backup.scopes.length > 0 ? backup.scopes : scopes,
        backup.cards,
        backup.srsMap ?? srsMap
      );
      if (backup.scopes && backup.scopes.length > 0) {
        setScopes(cleaned.scopes);
        setActiveScopeId(cleaned.scopes[0].id);
      }
      setCards(cleaned.cards);
      if (backup.srsMap || cleaned.removedCount > 0) {
        setSrsMap(cleaned.srsMap);
      }
      if (backup.dailyLogs) setDailyLogs(backup.dailyLogs);
      if (Array.isArray(backup.answerHistory)) {
        setAnswerHistory(backup.answerHistory);
      }
      showToast(
        cleaned.removedCount > 0
          ? `バックアップから ${cleaned.cards.length} 問を復元しました（重複 ${cleaned.removedCount} 問を自動除外）。`
          : `バックアップから ${cleaned.cards.length} 問を復元しました。`
      );
    },
    [scopes, srsMap, showToast]
  );

  const handleCreateScope = useCallback(
    (name: string, description: string) => {
      const now = Date.now();
      const newScope: ExamScope = {
        id: `scope-${now}`,
        name,
        description,
        createdAt: now,
      };
      setScopes((prev) => [...prev, newScope]);
      setActiveScopeId(newScope.id);
      showToast(`考査範囲「${name}」を作成しました。`);
    },
    [showToast]
  );

  const handleUpdateScope = useCallback(
    (id: string, name: string, description: string) => {
      setScopes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name, description } : s))
      );
      showToast(`考査範囲「${name}」を更新しました。`);
    },
    [showToast]
  );

  const handleDeleteScope = useCallback(
    (id: string) => {
      setScopes((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeScopeId === id) {
          setActiveScopeId(next[0]?.id ?? 'all');
        }
        return next;
      });
      setCards((prev) => prev.filter((c) => c.scopeId !== id));
      showToast('考査範囲を削除しました。');
    },
    [activeScopeId, showToast]
  );

  const handleExportCsv = useCallback(
    (cardsToExport: Flashcard[]) => {
      const csv = exportFlashcardsToCsv(cardsToExport);
      downloadTextFile(
        `chrononote-flashcards-${getLocalDateKey()}.csv`,
        csv,
        'text/csv;charset=utf-8'
      );
      showToast(`${cardsToExport.length} 問をCSV書き出ししました。`);
    },
    [showToast]
  );

  const handleExportBackupJson = useCallback(() => {
    const payload: FlashcardBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      scopes,
      cards,
      srsMap,
      dailyLogs,
      answerHistory,
    };
    downloadTextFile(
      `chrononote-flashcards-backup-${getLocalDateKey()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast('バックアップをJSON保存しました。');
  }, [scopes, cards, srsMap, dailyLogs, answerHistory, showToast]);

  const handleRestoreInitialTerm3 = useCallback(() => {
    const freshTerm3 = buildInitialTerm3Flashcards();
    setScopes((prev) => {
      const hasTerm3 = prev.some((s) => s.id === TERM3_SCOPE_ID);
      if (!hasTerm3) return [INITIAL_EXAM_SCOPES[0], ...prev];
      return prev.map((s) =>
        s.id === TERM3_SCOPE_ID
          ? { ...s, description: INITIAL_EXAM_SCOPES[0].description }
          : s
      );
    });
    setCards((prev) => {
      const nonTerm3 = prev.filter((c) => c.scopeId !== TERM3_SCOPE_ID);
      return [...freshTerm3, ...nonTerm3];
    });
    setActiveScopeId(TERM3_SCOPE_ID);
    showToast(`第3回定期考査（全${freshTerm3.length}問）を復元しました。`);
  }, [showToast]);

  const isInStudyFocus = subView === 'study';
  const showMobileBottomNav = !isInStudyFocus && !isStudyMobileDockActive;

  return (
    <div
      className={`space-y-6 ${
        isStudyMobileDockActive
          ? 'pb-36 md:pb-0'
          : showMobileBottomNav
            ? 'pb-20 md:pb-0'
            : 'pb-8 md:pb-0'
      }`}
    >
      {/* Clean 3-Pillar Desktop Navigation (hidden during distraction-free study stage) */}
      {!isInStudyFocus && (
        <div className="hidden md:flex items-center justify-between gap-4 pb-3 border-b border-[#E6E0D6]">
          <nav
            aria-label="一問一答セクション切替"
            className="flex items-center gap-1 p-1 bg-[#F4F0E8] rounded-lg"
          >
            <button
              type="button"
              onClick={() => setSubView('hub')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'hub'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              学習
              {totalDueInActiveScope > 0 && (
                <span className="font-mono text-xs tabular-nums text-[#9A3412] ml-0.5">
                  {totalDueInActiveScope}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSubView('analytics')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'analytics'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
              記録・履歴
            </button>

            <button
              type="button"
              onClick={() => setSubView('manage')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subView === 'manage'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              問題管理
            </button>
          </nav>

          {toastMessage && (
            <div
              role="status"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-md"
            >
              <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{toastMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Mobile floating toast */}
      {toastMessage && (
        <div
          role="status"
          className="md:hidden fixed left-4 right-4 bottom-20 z-40 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl shadow-md"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Active View */}
      {subView === 'hub' && (
        <FlashcardHubView
          scopes={scopes}
          cards={cards}
          srsMap={srsMap}
          activeScopeId={activeScopeId}
          todayReviews={todayReviews}
          hubPrefs={hubPrefs}
          savedSession={reconciledSavedSession}
          onChangeHubPrefs={setHubPrefs}
          onChangeScopeId={setActiveScopeId}
          onLaunchSession={handleLaunchSession}
          onResumeSession={handleResumeSavedSession}
          onDiscardSavedSession={handleDiscardSavedSession}
          onGoToManage={() => setSubView('manage')}
        />
      )}

      {subView === 'study' && activeSession && (
        <StudyStageView
          key={activeSession.sessionId}
          initialSession={activeSession}
          allCardsMap={allCardsMap}
          srsMap={srsMap}
          answerHistory={answerHistory}
          showCardAttemptDots={hubPrefs.showCardAttemptDots}
          onToggleCardAttemptDots={(enabled) =>
            setHubPrefs((prev) => ({ ...prev, showCardAttemptDots: enabled }))
          }
          onRateCard={handleRateCard}
          onUndoCardRate={handleUndoCardRate}
          onToggleStar={handleToggleStar}
          onToggleSuspend={handleToggleSuspend}
          onEditCard={(card) => {
            setEditingCard(card);
            setIsCardEditorOpen(true);
          }}
          onSyncSession={handleSyncActiveSession}
          onMobileDockActiveChange={setIsStudyMobileDockActive}
          onBackToHub={() => setSubView('hub')}
        />
      )}

      {subView === 'analytics' && (
        <ForgettingCurveAnalyticsView
          scopes={scopes}
          cards={cards}
          srsMap={srsMap}
          dailyLogs={dailyLogs}
          answerHistory={answerHistory}
          activeScopeId={activeScopeId}
          streakDays={streakDays}
          onLaunchSession={handleLaunchSession}
          onReviewCardIds={handleLaunchCustomCardIds}
          onClearHistory={handleClearAnswerHistory}
          onGoToHub={() => setSubView('hub')}
        />
      )}

      {subView === 'manage' && (
        <CardManageView
          scopes={scopes}
          cards={cards}
          srsMap={srsMap}
          activeScopeId={activeScopeId}
          onChangeScopeId={setActiveScopeId}
          onOpenAddCard={() => {
            setEditingCard(null);
            setIsCardEditorOpen(true);
          }}
          onEditCard={(card) => {
            setEditingCard(card);
            setIsCardEditorOpen(true);
          }}
          onDeleteCard={handleDeleteCard}
          onToggleStar={handleToggleStar}
          onToggleSuspend={handleToggleSuspend}
          onResetCardSrs={handleResetCardSrs}
          onOpenBulkImport={() => setIsBulkImportOpen(true)}
          onOpenScopeManager={() => setIsScopeManagerOpen(true)}
          onExportCsv={handleExportCsv}
          onExportBackupJson={handleExportBackupJson}
          onRestoreInitialTerm3={handleRestoreInitialTerm3}
        />
      )}

      {/* Clean 3-Tab Mobile Bottom Navigation Bar */}
      {showMobileBottomNav && (
        <nav
          aria-label="一問一答モバイルナビゲーション"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-md border-t border-[#E6E0D6] pb-safe"
        >
          <div className="grid grid-cols-3 h-15">
            <button
              type="button"
              onClick={() => {
                setSubView('hub');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-current={subView === 'hub' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                subView === 'hub' ? 'text-[#9A3412]' : 'text-[#57534E]'
              }`}
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap">
                学習{totalDueInActiveScope > 0 ? ` (${totalDueInActiveScope})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubView('analytics');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-current={subView === 'analytics' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                subView === 'analytics' ? 'text-[#9A3412]' : 'text-[#57534E]'
              }`}
            >
              <BarChart3 className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap">記録</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubView('manage');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              aria-current={subView === 'manage' ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                subView === 'manage' ? 'text-[#9A3412]' : 'text-[#57534E]'
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap">管理</span>
            </button>
          </div>
        </nav>
      )}

      {/* Modals */}
      <CardEditorModal
        isOpen={isCardEditorOpen}
        editingCard={editingCard}
        scopes={scopes}
        defaultScopeId={activeScopeId}
        existingChapters={existingChapters}
        existingUnits={existingUnits}
        suggestedTags={suggestedTags}
        nextNumber={nextNumber}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        onClose={() => {
          setIsCardEditorOpen(false);
          setEditingCard(null);
        }}
      />

      <BulkImportModal
        isOpen={isBulkImportOpen}
        scopes={scopes}
        defaultScopeId={activeScopeId}
        nextNumber={nextNumber}
        onImportCards={handleImportCards}
        onRestoreBackup={handleRestoreBackup}
        onClose={() => setIsBulkImportOpen(false)}
      />

      <ScopeManagerModal
        isOpen={isScopeManagerOpen}
        scopes={scopes}
        cardCountsByScope={cardCountsByScope}
        onCreateScope={handleCreateScope}
        onUpdateScope={handleUpdateScope}
        onDeleteScope={handleDeleteScope}
        onClose={() => setIsScopeManagerOpen(false)}
      />
    </div>
  );
}
