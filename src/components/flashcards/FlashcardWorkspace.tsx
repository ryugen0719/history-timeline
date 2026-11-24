import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Check,
  LayoutGrid,
  ListChecks,
} from 'lucide-react';
import {
  buildInitialTerm3Flashcards,
  INITIAL_EXAM_SCOPES,
  INITIAL_FLASHCARDS,
  TERM3_SCOPE_ID,
} from '../../data/initialFlashcards';
import type {
  DailyStudyLogsMap,
  ExamScope,
  Flashcard,
  FlashcardBackupPayload,
  FlashcardSubView,
  SrsProgress,
  SrsProgressMap,
  SrsRating,
  StudySessionConfig,
} from '../../types/flashcards';
import { buildStudyQueue } from '../../utils/flashcardFilter';
import { exportFlashcardsToCsv } from '../../utils/flashcardParser';
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

const DEFAULT_SESSION_CONFIG: StudySessionConfig = {
  scopeId: TERM3_SCOPE_ID,
  chapter: 'all',
  unit: 'all',
  selectedTags: [],
  tagMatchMode: 'and',
  filterPreset: 'all',
  orderMode: 'unit',
  swapFrontBack: false,
  recordToSrs: true,
  mode: 'flip',
  label: '第3回定期考査範囲',
};

export function FlashcardWorkspace() {
  const [scopes, setScopes] = useState<ExamScope[]>(() => {
    const saved = loadFromStorage<ExamScope[] | null>(STORAGE_KEY_SCOPES, null);
    return saved && saved.length > 0 ? saved : INITIAL_EXAM_SCOPES;
  });

  const [cards, setCards] = useState<Flashcard[]>(() => {
    const saved = loadFromStorage<Flashcard[] | null>(STORAGE_KEY_CARDS, null);
    return saved && saved.length > 0 ? saved : INITIAL_FLASHCARDS;
  });

  const [srsMap, setSrsMap] = useState<SrsProgressMap>(() =>
    loadFromStorage<SrsProgressMap>(STORAGE_KEY_SRS, {})
  );

  const [dailyLogs, setDailyLogs] = useState<DailyStudyLogsMap>(() =>
    loadFromStorage<DailyStudyLogsMap>(STORAGE_KEY_LOGS, {})
  );

  const [subView, setSubView] = useState<FlashcardSubView>('hub');
  const [activeScopeId, setActiveScopeId] = useState<string>(
    () => scopes[0]?.id ?? TERM3_SCOPE_ID
  );

  const [sessionConfig, setSessionConfig] = useState<StudySessionConfig>(
    DEFAULT_SESSION_CONFIG
  );
  const [sessionQueue, setSessionQueue] = useState<Flashcard[]>(() =>
    buildStudyQueue(INITIAL_FLASHCARDS, {}, DEFAULT_SESSION_CONFIG)
  );
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
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
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

  const handleLaunchSession = useCallback(
    (config: StudySessionConfig) => {
      const queue = buildStudyQueue(cards, srsMap, config, Date.now());
      setSessionConfig(config);
      setSessionQueue(queue);
      setSubView('study');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [cards, srsMap]
  );

  const handleOpenStudyTabDirectly = () => {
    if (sessionQueue.length === 0) {
      const hasDue = totalDueInActiveScope > 0;
      const scopeName =
        activeScopeId === 'all'
          ? 'すべての考査範囲'
          : scopes.find((s) => s.id === activeScopeId)?.name ?? '選択範囲';
      handleLaunchSession({
        ...DEFAULT_SESSION_CONFIG,
        scopeId: activeScopeId,
        filterPreset: hasDue ? 'due' : 'all',
        orderMode: hasDue ? 'srs' : 'unit',
        label: hasDue ? `${scopeName} · 今日の復習` : scopeName,
      });
    } else {
      setSubView('study');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRateCard = useCallback(
    (cardId: string, rating: SrsRating, recordToSrs: boolean) => {
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

      return { previous, requeueInSession };
    },
    [srsMap]
  );

  const handleUndoCardRate = useCallback(
    (cardId: string, previous: SrsProgress, wasRecorded: boolean) => {
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
      showToast('カードの学習履歴を未学習にリセットしました。');
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
        showToast(`新しい問題（No.${payload.number}）を追加しました。`);
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
      setSessionQueue((prev) => prev.filter((c) => c.id !== cardId));
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
          ? `「${payload.newScope.name}」を作成し、${payload.cards.length}問を追加しました。`
          : `${payload.cards.length}問を一括追加しました。`
      );
    },
    [showToast]
  );

  const handleRestoreBackup = useCallback(
    (backup: FlashcardBackupPayload) => {
      if (backup.scopes && backup.scopes.length > 0) {
        setScopes(backup.scopes);
        setActiveScopeId(backup.scopes[0].id);
      }
      setCards(backup.cards);
      if (backup.srsMap) setSrsMap(backup.srsMap);
      if (backup.dailyLogs) setDailyLogs(backup.dailyLogs);
      showToast(`バックアップから ${backup.cards.length} 問と学習履歴を復元しました。`);
    },
    [showToast]
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
      showToast('考査範囲と含まれる問題を削除しました。');
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
      showToast(`${cardsToExport.length}問をCSV形式で書き出しました。`);
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
    };
    downloadTextFile(
      `chrononote-flashcards-backup-${getLocalDateKey()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast('問題データと忘却曲線履歴をJSONバックアップ保存しました。');
  }, [scopes, cards, srsMap, dailyLogs, showToast]);

  const handleRestoreInitialTerm3 = useCallback(() => {
    const freshTerm3 = buildInitialTerm3Flashcards();
    setScopes((prev) => {
      const hasTerm3 = prev.some((s) => s.id === TERM3_SCOPE_ID);
      return hasTerm3 ? prev : [INITIAL_EXAM_SCOPES[0], ...prev];
    });
    setCards((prev) => {
      const nonTerm3 = prev.filter((c) => c.scopeId !== TERM3_SCOPE_ID);
      return [...freshTerm3, ...nonTerm3];
    });
    setActiveScopeId(TERM3_SCOPE_ID);
    showToast(`第3回定期考査範囲（全${freshTerm3.length}問）を初期状態に復元しました。`);
  }, [showToast]);

  const showMobileBottomNav = !isStudyMobileDockActive;

  return (
    <div
      className={`space-y-5 md:space-y-6 ${
        isStudyMobileDockActive ? 'pb-40 md:pb-0' : 'pb-20 md:pb-0'
      }`}
    >
      {/* Desktop sub-navigation bar (hidden on mobile where bottom thumb bar takes over) */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E6E0D6]">
        <nav
          aria-label="一問一答ページ内ナビゲーション"
          className="flex items-center gap-1 p-1 bg-[#F4F0E8] rounded-lg"
        >
          <button
            type="button"
            onClick={() => setSubView('hub')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'hub'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            学習ハブ・タグ別
          </button>

          <button
            type="button"
            onClick={handleOpenStudyTabDirectly}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'study'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            演習ステージ
            {totalDueInActiveScope > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-[#9A3412] font-semibold">
                ({totalDueInActiveScope})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubView('analytics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'analytics'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            忘却曲線・統計
          </button>

          <button
            type="button"
            onClick={() => setSubView('manage')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subView === 'manage'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            <ListChecks className="w-4 h-4" aria-hidden="true" />
            問題一覧・追加
          </button>
        </nav>

        {/* Desktop quiet status toast */}
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

      {/* Active Sub-View */}
      {subView === 'hub' && (
        <FlashcardHubView
          scopes={scopes}
          cards={cards}
          srsMap={srsMap}
          activeScopeId={activeScopeId}
          streakDays={streakDays}
          todayReviews={todayReviews}
          onChangeScopeId={setActiveScopeId}
          onLaunchSession={handleLaunchSession}
          onOpenAddCard={() => {
            setEditingCard(null);
            setIsCardEditorOpen(true);
          }}
          onOpenBulkImport={() => setIsBulkImportOpen(true)}
          onOpenScopeManager={() => setIsScopeManagerOpen(true)}
        />
      )}

      {subView === 'study' && (
        <StudyStageView
          config={sessionConfig}
          initialQueue={sessionQueue}
          allCardsMap={allCardsMap}
          srsMap={srsMap}
          onRateCard={handleRateCard}
          onUndoCardRate={handleUndoCardRate}
          onToggleStar={handleToggleStar}
          onToggleSuspend={handleToggleSuspend}
          onEditCard={(card) => {
            setEditingCard(card);
            setIsCardEditorOpen(true);
          }}
          onUpdateConfig={(patch) =>
            setSessionConfig((prev) => ({ ...prev, ...patch }))
          }
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
          activeScopeId={activeScopeId}
          streakDays={streakDays}
          onLaunchSession={handleLaunchSession}
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
          onExportCsv={handleExportCsv}
          onExportBackupJson={handleExportBackupJson}
          onRestoreInitialTerm3={handleRestoreInitialTerm3}
        />
      )}

      {/* Mobile Fixed Thumb-Zone Bottom Navigation Bar (hidden during active flip/typing dock) */}
      {showMobileBottomNav && (
        <nav
          aria-label="一問一答モバイルナビゲーション"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-md border-t border-[#E6E0D6] pb-safe"
        >
          <div className="grid grid-cols-4 h-15">
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
              <LayoutGrid className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap">ハブ</span>
            </button>

            <button
              type="button"
              onClick={handleOpenStudyTabDirectly}
              aria-current={subView === 'study' ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                subView === 'study' ? 'text-[#9A3412]' : 'text-[#57534E]'
              }`}
            >
              <BookOpen className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap">
                演習{totalDueInActiveScope > 0 ? `(${totalDueInActiveScope})` : ''}
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
              <span className="text-[11px] font-medium whitespace-nowrap">忘却曲線</span>
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
              <ListChecks className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-medium whitespace-nowrap">一覧・追加</span>
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
