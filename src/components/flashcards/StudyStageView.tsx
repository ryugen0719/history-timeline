import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Eye,
  EyeOff,
  HelpCircle,
  List,
  PauseCircle,
  RotateCcw,
  Settings2,
  Shuffle,
  SkipForward,
  Star,
  Undo2,
  Volume2,
  X,
} from 'lucide-react';
import type {
  Flashcard,
  PersistedStudySession,
  SrsProgress,
  SrsProgressMap,
  SrsRating,
  StudyMode,
  StudySessionConfig,
} from '../../types/flashcards';
import { parseTagMeta } from '../../utils/flashcardParser';
import {
  calculateRetentionPercent,
  evaluateTypedAnswer,
  formatDueRelative,
  getCardStatusLabel,
  getMemoryStabilityDays,
  getSrsProgress,
  previewRatingIntervals,
} from '../../utils/srsEngine';
import {
  classifySwipeGesture,
  computeRedSheetStats,
  filterRedSheetCards,
  getRecommendedRatingForTyping,
  skipCardInQueue,
  uniqueCardsFromQueueIds,
  type RedSheetFilter,
} from '../../utils/studySession';

interface StudyStageViewProps {
  initialSession: PersistedStudySession;
  allCardsMap: Record<string, Flashcard>;
  srsMap: SrsProgressMap;
  onRateCard: (
    cardId: string,
    rating: SrsRating,
    recordToSrs: boolean
  ) => { previous: SrsProgress; requeueInSession: boolean };
  onUndoCardRate: (cardId: string, previous: SrsProgress, wasRecorded: boolean) => void;
  onToggleStar: (cardId: string) => void;
  onToggleSuspend: (cardId: string) => void;
  onEditCard: (card: Flashcard) => void;
  onSyncSession: (next: PersistedStudySession | null) => void;
  onMobileDockActiveChange?: (active: boolean) => void;
  onBackToHub: () => void;
}

interface UndoEntry {
  cardId: string;
  previousProgress: SrsProgress;
  wasRecorded: boolean;
  previousQueueIds: string[];
  previousIndex: number;
  previousRating: SrsRating;
}

const RATING_BUTTONS: Array<{
  rating: SrsRating;
  keyHint: string;
  label: string;
  baseClass: string;
  recommendedRing: string;
}> = [
  {
    rating: 1,
    keyHint: '1',
    label: 'もう一度',
    baseClass:
      'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] active:scale-[0.98] hover:bg-[#FEE2E2] hover:border-[#DC2626]',
    recommendedRing: 'ring-2 ring-[#DC2626] ring-offset-1',
  },
  {
    rating: 2,
    keyHint: '2',
    label: '難しい',
    baseClass:
      'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] active:scale-[0.98] hover:bg-[#FEF3C7] hover:border-[#D97706]',
    recommendedRing: 'ring-2 ring-[#D97706] ring-offset-1',
  },
  {
    rating: 3,
    keyHint: '3',
    label: '普通',
    baseClass:
      'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] active:scale-[0.98] hover:bg-[#DBEAFE] hover:border-[#2563EB]',
    recommendedRing: 'ring-2 ring-[#2563EB] ring-offset-1',
  },
  {
    rating: 4,
    keyHint: '4',
    label: '簡単',
    baseClass:
      'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] active:scale-[0.98] hover:bg-[#DCFCE7] hover:border-[#16A34A]',
    recommendedRing: 'ring-2 ring-[#16A34A] ring-offset-1',
  },
];

const MODE_OPTIONS: Array<{ id: StudyMode; label: string }> = [
  { id: 'flip', label: 'カード' },
  { id: 'typing', label: '記述' },
  { id: 'redsheet', label: '赤シート' },
];

function MiniCardCurveSvg({ progress }: { progress: SrsProgress }) {
  const stability = getMemoryStabilityDays(progress);
  const currentRetention = calculateRetentionPercent(progress) ?? 100;
  const horizonDays = Math.max(
    7,
    Math.min(60, Math.round(Math.max(progress.intervalDays * 1.8, 10)))
  );

  const points: string[] = [];
  const width = 260;
  const height = 84;
  const padL = 24;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const effectiveS = stability > 0 ? stability : 1.5;
  for (let i = 0; i <= 24; i++) {
    const day = (horizonDays * i) / 24;
    const r = Math.exp(-day / effectiveS);
    const x = padL + (plotW * i) / 24;
    const y = padT + plotH * (1 - r);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const elapsedDays = progress.lastReviewedAt
    ? Math.max(0, (Date.now() - progress.lastReviewedAt) / (24 * 60 * 60 * 1000))
    : 0;
  const clampedElapsed = Math.min(horizonDays, elapsedDays);
  const markerX = padL + (plotW * clampedElapsed) / horizonDays;
  const markerY = padT + plotH * (1 - currentRetention / 100);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="このカードの忘却曲線"
    >
      {[100, 50, 0].map((pct) => {
        const y = padT + plotH * (1 - pct / 100);
        return (
          <g key={pct}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke="#E6E0D6"
              strokeWidth="1"
              strokeDasharray={pct === 50 ? '2 2' : undefined}
            />
            <text
              x={padL - 4}
              y={y + 3}
              textAnchor="end"
              fontSize="8"
              fill="#78716C"
              className="font-mono"
            >
              {pct}
            </text>
          </g>
        );
      })}
      <polyline
        fill="none"
        stroke={progress.state === 'new' ? '#A8A29E' : '#9A3412'}
        strokeWidth="2"
        strokeDasharray={progress.state === 'new' ? '4 3' : undefined}
        points={points.join(' ')}
      />
      {progress.state !== 'new' && (
        <circle
          cx={markerX}
          cy={markerY}
          r="3.5"
          fill="#9A3412"
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />
      )}
      <text x={padL} y={height - 3} fontSize="8" fill="#78716C" className="font-mono">
        0日
      </text>
      <text
        x={width - padR}
        y={height - 3}
        textAnchor="end"
        fontSize="8"
        fill="#78716C"
        className="font-mono"
      >
        {horizonDays}日後
      </text>
    </svg>
  );
}

export function StudyStageView({
  initialSession,
  allCardsMap,
  srsMap,
  onRateCard,
  onUndoCardRate,
  onToggleStar,
  onToggleSuspend,
  onEditCard,
  onSyncSession,
  onMobileDockActiveChange,
  onBackToHub,
}: StudyStageViewProps) {
  const [config, setConfig] = useState<StudySessionConfig>(initialSession.config);
  const [queueIds, setQueueIds] = useState<string[]>(initialSession.queueIds);
  const [currentIndex, setCurrentIndex] = useState<number>(initialSession.currentIndex);
  const [ratingCounts, setRatingCounts] = useState<Record<SrsRating, number>>(
    initialSession.ratingCounts
  );
  const [againCardIds, setAgainCardIds] = useState<string[]>(initialSession.againCardIds);
  const [redSheetRated, setRedSheetRated] = useState<Record<string, SrsRating>>(
    initialSession.redSheetRated
  );

  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingChecked, setTypingChecked] = useState<null | {
    verdict: 'exact' | 'partial' | 'mismatch';
    coreExpected: string;
  }>(null);

  // Drawers / sheets
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Touch swipe tracking with live compositor transform
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeFeedback, setSwipeFeedback] = useState<'left' | 'right' | null>(null);

  // Red-sheet controls
  const [redSheetHideAll, setRedSheetHideAll] = useState(true);
  const [redSheetFilter, setRedSheetFilter] = useState<RedSheetFilter>('all');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  // Undo & audio
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [quickStatusNote, setQuickStatusNote] = useState<string | null>(null);

  const typingInputRef = useRef<HTMLInputElement | null>(null);

  const showQuickNote = useCallback((msg: string) => {
    setQuickStatusNote(msg);
  }, []);

  useEffect(() => {
    if (!quickStatusNote) return;
    const t = window.setTimeout(() => setQuickStatusNote(null), 1600);
    return () => window.clearTimeout(t);
  }, [quickStatusNote]);

  const redSheetCards = useMemo(
    () => uniqueCardsFromQueueIds(queueIds, allCardsMap),
    [queueIds, allCardsMap]
  );

  const currentCardId = queueIds[currentIndex];
  const currentCard = currentCardId ? allCardsMap[currentCardId] : undefined;
  const isFinished = queueIds.length > 0 && currentIndex >= queueIds.length;

  // Persist active session progress continuously so users never lose their place
  useEffect(() => {
    if (queueIds.length === 0) return;
    if (config.mode !== 'redsheet' && isFinished) {
      onSyncSession(null);
      return;
    }
    onSyncSession({
      sessionId: initialSession.sessionId,
      config,
      queueIds,
      currentIndex,
      ratingCounts,
      againCardIds,
      redSheetRated,
      updatedAt: Date.now(),
    });
  }, [
    initialSession.sessionId,
    config,
    queueIds,
    currentIndex,
    ratingCounts,
    againCardIds,
    redSheetRated,
    isFinished,
    onSyncSession,
  ]);

  const shouldUseMobileDock =
    config.mode !== 'redsheet' &&
    queueIds.length > 0 &&
    !isFinished &&
    Boolean(currentCard);

  useEffect(() => {
    onMobileDockActiveChange?.(shouldUseMobileDock);
    return () => onMobileDockActiveChange?.(false);
  }, [shouldUseMobileDock, onMobileDockActiveChange]);

  const currentProgress = useMemo(
    () => (currentCard ? getSrsProgress(srsMap, currentCard.id) : null),
    [currentCard, srsMap]
  );

  const ratingPreviews = useMemo(
    () => (currentProgress ? previewRatingIntervals(currentProgress) : null),
    [currentProgress]
  );

  const recommendedTypingRating: SrsRating | null = useMemo(() => {
    if (config.mode !== 'typing' || !isFlipped || !typingChecked) return null;
    return getRecommendedRatingForTyping(typingChecked.verdict);
  }, [config.mode, isFlipped, typingChecked]);

  const promptText = currentCard
    ? config.swapFrontBack
      ? currentCard.back
      : currentCard.front
    : '';
  const answerText = currentCard
    ? config.swapFrontBack
      ? currentCard.front
      : currentCard.back
    : '';

  const hintText = useMemo(() => {
    const clean = answerText.trim();
    if (!clean) return '';
    const firstTwo = clean.slice(0, Math.min(2, clean.length));
    return `先頭「${firstTwo}…」 / 全 ${clean.length} 文字`;
  }, [answerText]);

  const resetCardInteractionState = useCallback(() => {
    setIsFlipped(false);
    setShowHint(false);
    setTypedAnswer('');
    setTypingChecked(null);
    setSwipeOffsetX(0);
    setIsSwiping(false);
    setSwipeFeedback(null);
  }, []);

  const handleUpdateConfig = useCallback((patch: Partial<StudySessionConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSwitchMode = useCallback(
    (nextMode: StudyMode) => {
      if (nextMode === config.mode) return;
      handleUpdateConfig({ mode: nextMode });
      resetCardInteractionState();
    },
    [config.mode, handleUpdateConfig, resetCardInteractionState]
  );

  const handleRate = useCallback(
    (rating: SrsRating) => {
      if (!currentCard) return;
      const { previous, requeueInSession } = onRateCard(
        currentCard.id,
        rating,
        config.recordToSrs
      );

      setUndoStack((prev) => [
        ...prev,
        {
          cardId: currentCard.id,
          previousProgress: previous,
          wasRecorded: config.recordToSrs,
          previousQueueIds: queueIds,
          previousIndex: currentIndex,
          previousRating: rating,
        },
      ]);

      setRatingCounts((prev) => ({
        ...prev,
        [rating]: prev[rating] + 1,
      }));

      if (rating === 1) {
        setAgainCardIds((prev) =>
          prev.includes(currentCard.id) ? prev : [...prev, currentCard.id]
        );
      }

      if (requeueInSession) {
        const insertPos = Math.min(queueIds.length, currentIndex + 4);
        setQueueIds([
          ...queueIds.slice(0, insertPos),
          currentCard.id,
          ...queueIds.slice(insertPos),
        ]);
      }

      setCurrentIndex((idx) => idx + 1);
      resetCardInteractionState();
    },
    [
      currentCard,
      onRateCard,
      config.recordToSrs,
      queueIds,
      currentIndex,
      resetCardInteractionState,
    ]
  );

  const handleUndo = useCallback(() => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    onUndoCardRate(last.cardId, last.previousProgress, last.wasRecorded);
    setUndoStack((prev) => prev.slice(0, -1));
    setQueueIds(last.previousQueueIds);
    setCurrentIndex(last.previousIndex);
    setRatingCounts((prev) => ({
      ...prev,
      [last.previousRating]: Math.max(0, prev[last.previousRating] - 1),
    }));
    setIsFlipped(true);
    setShowHint(false);
    setSwipeOffsetX(0);
    setSwipeFeedback(null);
    showQuickNote('1つ前の問題に戻しました');
  }, [undoStack, onUndoCardRate, showQuickNote]);

  const handleDeferCurrentCard = useCallback(() => {
    if (!currentCard || currentIndex >= queueIds.length - 1) return;
    const res = skipCardInQueue(queueIds, currentIndex, 'defer');
    setQueueIds(res.queueIds);
    setCurrentIndex(res.nextIndex);
    resetCardInteractionState();
    showQuickNote('あとで出題に回しました');
  }, [currentCard, currentIndex, queueIds, resetCardInteractionState, showQuickNote]);

  const handleJumpToIndex = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= queueIds.length) return;
      setCurrentIndex(targetIdx);
      resetCardInteractionState();
      setIsQueueOpen(false);
    },
    [queueIds.length, resetCardInteractionState]
  );

  const handleSpeak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !currentCard) {
      return;
    }
    window.speechSynthesis.cancel();
    const text = isFlipped ? answerText : promptText;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [currentCard, isFlipped, answerText, promptText]);

  const handleCheckTyping = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCard) return;
    const result = evaluateTypedAnswer(typedAnswer, answerText);
    setTypingChecked(result);
    setIsFlipped(true);
  };

  const handleShuffleRemaining = () => {
    if (currentIndex >= queueIds.length - 1) return;
    const done = queueIds.slice(0, currentIndex);
    const rest = [...queueIds.slice(currentIndex)];
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    setQueueIds([...done, ...rest]);
    resetCardInteractionState();
    setIsSettingsOpen(false);
    showQuickNote('残りの問題をシャッフルしました');
  };

  const handleRetryAgainCards = () => {
    if (againCardIds.length === 0) return;
    setQueueIds([...againCardIds]);
    setCurrentIndex(0);
    resetCardInteractionState();
    setAgainCardIds([]);
    setRatingCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setUndoStack([]);
  };

  const handleRestartAll = () => {
    setQueueIds([...initialSession.queueIds]);
    setCurrentIndex(0);
    resetCardInteractionState();
    setAgainCardIds([]);
    setRatingCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setUndoStack([]);
  };

  // Touch swipe handlers with real finger-tracking horizontal motion
  const handleCardTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (config.mode !== 'flip') return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsSwiping(true);
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (config.mode !== 'flip' || !isFlipped || !touchStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      const clamped = Math.max(-110, Math.min(110, dx));
      setSwipeOffsetX(clamped);
      setSwipeFeedback(classifySwipeGesture(dx, dy, 52));
    } else {
      setSwipeOffsetX(0);
      setSwipeFeedback(null);
    }
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (config.mode !== 'flip' || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      setIsSwiping(false);
      setSwipeOffsetX(0);
      setSwipeFeedback(null);
      return;
    }
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    setIsSwiping(false);

    const gesture = isFlipped ? classifySwipeGesture(dx, dy, 68) : null;
    if (gesture) {
      handleRate(gesture === 'left' ? 1 : 3);
      return;
    }
    setSwipeOffsetX(0);
    setSwipeFeedback(null);
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQueueOpen) {
          setIsQueueOpen(false);
          return;
        }
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
      }

      if (
        config.mode === 'redsheet' ||
        isFinished ||
        !currentCard ||
        isSettingsOpen ||
        isQueueOpen
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isInputFocused) return;

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        if (config.mode === 'flip') {
          setIsFlipped((prev) => !prev);
        } else if (config.mode === 'typing' && isFlipped && recommendedTypingRating) {
          handleRate(recommendedTypingRating);
        }
      } else if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(Number(e.key) as SrsRating);
      } else if (isFlipped && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleRate(1);
      } else if (isFlipped && e.key === 'ArrowRight') {
        e.preventDefault();
        handleRate(3);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleDeferCurrentCard();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowHint((prev) => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        onToggleStar(currentCard.id);
      } else if (
        (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') &&
        undoStack.length > 0
      ) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    config.mode,
    isFinished,
    currentCard,
    isSettingsOpen,
    isQueueOpen,
    isFlipped,
    recommendedTypingRating,
    handleRate,
    handleDeferCurrentCard,
    onToggleStar,
    undoStack.length,
    handleUndo,
  ]);

  // Auto-focus typing input on desktop when moving to next question
  useEffect(() => {
    if (
      config.mode === 'typing' &&
      !isFlipped &&
      !isFinished &&
      !isSettingsOpen &&
      !isQueueOpen
    ) {
      if (window.innerWidth >= 768) {
        typingInputRef.current?.focus();
      }
    }
  }, [config.mode, currentIndex, isFlipped, isFinished, isSettingsOpen, isQueueOpen]);

  const redSheetStats = useMemo(
    () => computeRedSheetStats(redSheetCards, redSheetRated),
    [redSheetCards, redSheetRated]
  );

  const visibleRedSheetCards = useMemo(
    () => filterRedSheetCards(redSheetCards, redSheetRated, redSheetFilter),
    [redSheetCards, redSheetRated, redSheetFilter]
  );

  const totalAnswered =
    ratingCounts[1] + ratingCounts[2] + ratingCounts[3] + ratingCounts[4];
  const accuracyPct =
    totalAnswered > 0
      ? Math.round(
          ((ratingCounts[2] + ratingCounts[3] + ratingCounts[4]) / totalAnswered) * 100
        )
      : 0;

  if (queueIds.length === 0) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-8 text-center space-y-4">
        <h2 className="text-lg font-serif font-bold text-[#1C1917]">
          該当する問題がありません
        </h2>
        <p className="text-sm text-[#57534E]">
          選択した条件に一致するカードは0件です。
        </p>
        <button
          type="button"
          onClick={onBackToHub}
          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 text-sm font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          学習に戻る
        </button>
      </div>
    );
  }

  const canDefer = currentIndex < queueIds.length - 1;
  const swipeRotationDeg = (swipeOffsetX / 110) * 3.5;

  return (
    <div
      className={
        config.mode === 'redsheet'
          ? 'max-w-4xl mx-auto space-y-3.5'
          : 'max-w-2xl mx-auto space-y-3.5'
      }
    >
      {/* TIER 1: Compact Top Bar with Clickable Progress Jump & Clear Undo */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackToHub}
          className="inline-flex items-center gap-1.5 min-h-[42px] px-2.5 -ml-1 text-xs sm:text-sm font-medium text-[#57534E] hover:text-[#1C1917] rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          戻る
        </button>

        <div className="min-w-0 text-center flex-1">
          <div className="text-xs sm:text-sm font-medium text-[#1C1917] truncate max-w-[200px] sm:max-w-[340px] mx-auto">
            {config.label || '一問一答'}
          </div>
          {config.mode === 'redsheet' ? (
            <div className="text-[11px] text-[#78716C] font-mono tabular-nums">
              確認済 {redSheetStats.rated} / {redSheetStats.total}問
            </div>
          ) : isFinished ? (
            <div className="text-[11px] text-[#15803D] font-mono tabular-nums">
              全{queueIds.length}問 完了
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsQueueOpen(true)}
              aria-label="問題リストを開いて移動"
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded-md font-mono tabular-nums transition-colors"
            >
              <List className="w-3 h-3" aria-hidden="true" />
              <span>
                {Math.min(currentIndex + 1, queueIds.length)} / {queueIds.length}
              </span>
              <ChevronDown className="w-3 h-3 opacity-70" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {config.mode !== 'redsheet' && !isFinished && undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              aria-label="1つ前の問題に戻す"
              title="1つ戻す (Z)"
              className="inline-flex items-center gap-1 min-h-[40px] px-2.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded-lg transition-colors whitespace-nowrap"
            >
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">戻す</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="モード・設定を開く"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-2.5 text-xs font-medium text-[#57534E] hover:text-[#1C1917] bg-white border border-[#E6E0D6] hover:border-[#1C1917] rounded-lg transition-colors whitespace-nowrap"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">設定</span>
          </button>
        </div>
      </div>

      {/* Inline 1-Tap Study Mode Switcher (Eliminates opening Settings just to switch modes) */}
      {!isFinished && (
        <div className="flex items-center justify-between gap-2">
          <div
            role="group"
            aria-label="学習モード切替"
            className="grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-[#F4F0E8] rounded-lg w-full sm:w-auto"
          >
            {MODE_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={config.mode === m.id}
                onClick={() => handleSwitchMode(m.id)}
                className={`min-h-[36px] sm:min-h-[30px] px-3.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  config.mode === m.id
                    ? 'bg-white text-[#1C1917] shadow-xs'
                    : 'text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {quickStatusNote && (
            <div
              role="status"
              className="hidden sm:inline-flex text-xs text-[#9A3412] font-medium whitespace-nowrap"
            >
              {quickStatusNote}
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Red Sheet Rapid List Mode */}
      {config.mode === 'redsheet' ? (
        <div className="space-y-3">
          {/* Sticky Rapid Control Bar */}
          <div className="sticky top-0 md:top-14 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-[#FBF9F5]/95 backdrop-blur-sm border-b sm:border-b-0 border-[#E6E0D6] flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label="赤シート絞り込み"
              className="flex items-center p-1 bg-[#F4F0E8] rounded-lg"
            >
              {(
                [
                  { id: 'all', label: `すべて (${redSheetStats.total})` },
                  {
                    id: 'unrated',
                    label: `未評価 (${redSheetStats.total - redSheetStats.rated})`,
                  },
                  { id: 'again', label: `要復習 (${redSheetStats.again})` },
                ] as Array<{ id: RedSheetFilter; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={redSheetFilter === f.id}
                  onClick={() => setRedSheetFilter(f.id)}
                  className={`min-h-[34px] sm:min-h-[30px] px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap font-mono tabular-nums ${
                    redSheetFilter === f.id
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setRedSheetHideAll((prev) => !prev);
                setRevealedIds({});
              }}
              className="inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[34px] px-3 text-xs font-medium text-[#1C1917] bg-white border border-[#E6E0D6] hover:border-[#1C1917] rounded-lg whitespace-nowrap transition-colors"
            >
              {redSheetHideAll ? (
                <>
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  すべて表示
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  すべて隠す
                </>
              )}
            </button>
          </div>

          {visibleRedSheetCards.length === 0 ? (
            <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-8 text-center space-y-3">
              <p className="text-sm text-[#57534E]">
                {redSheetFilter === 'unrated'
                  ? 'すべての問題を評価し終えました。'
                  : '「要復習」にマークされた問題はありません。'}
              </p>
              <button
                type="button"
                onClick={() => setRedSheetFilter('all')}
                className="min-h-[40px] px-4 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg transition-colors"
              >
                すべて表示に戻す
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl divide-y divide-[#E6E0D6]">
              {visibleRedSheetCards.map((card) => {
                const isRevealed = !redSheetHideAll || Boolean(revealedIds[card.id]);
                const rated = redSheetRated[card.id];
                const qText = config.swapFrontBack ? card.back : card.front;
                const aText = config.swapFrontBack ? card.front : card.back;

                return (
                  <div
                    key={card.id}
                    className={`p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 items-start transition-colors ${
                      rated === 3
                        ? 'bg-[#F0FDF4]/35'
                        : rated === 1
                          ? 'bg-[#FEF2F2]/35'
                          : ''
                    }`}
                  >
                    <div className="lg:col-span-6 space-y-1">
                      <div className="text-xs text-[#78716C] font-mono tabular-nums">
                        No.{card.number} · {card.unit}
                      </div>
                      <p className="text-[15px] text-[#1C1917] leading-relaxed">{qText}</p>
                    </div>

                    <div className="lg:col-span-4">
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedIds((prev) => ({
                            ...prev,
                            [card.id]: !isRevealed,
                          }))
                        }
                        className={`w-full text-left px-4 py-3 rounded-xl sm:rounded-lg border transition-colors min-h-[48px] active:scale-[0.99] ${
                          isRevealed
                            ? 'bg-[#FBF9F5] border-[#E6E0D6] text-[#9A3412] font-serif font-semibold text-[15px]'
                            : 'bg-[#9A3412] border-[#9A3412] text-transparent select-none hover:bg-[#7C2D12]'
                        }`}
                        aria-label={isRevealed ? '解答を隠す' : '解答を表示'}
                      >
                        {isRevealed ? (
                          <span>{aText}</span>
                        ) : (
                          <span className="text-xs text-[#FBF9F5]/90 font-sans">
                            タップして解答を表示
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="lg:col-span-2 grid grid-cols-2 gap-1.5 shrink-0">
                      <button
                        type="button"
                        aria-pressed={rated === 1}
                        onClick={() => {
                          if (rated === 1) {
                            setRedSheetRated((prev) => {
                              const next = { ...prev };
                              delete next[card.id];
                              return next;
                            });
                          } else {
                            onRateCard(card.id, 1, config.recordToSrs);
                            setRedSheetRated((prev) => ({ ...prev, [card.id]: 1 }));
                          }
                        }}
                        className={`min-h-[44px] lg:min-h-[38px] px-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                          rated === 1
                            ? 'bg-[#DC2626] text-white border-[#DC2626]'
                            : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                        }`}
                      >
                        要復習
                      </button>
                      <button
                        type="button"
                        aria-pressed={rated === 3}
                        onClick={() => {
                          if (rated === 3) {
                            setRedSheetRated((prev) => {
                              const next = { ...prev };
                              delete next[card.id];
                              return next;
                            });
                          } else {
                            onRateCard(card.id, 3, config.recordToSrs);
                            setRedSheetRated((prev) => ({ ...prev, [card.id]: 3 }));
                          }
                        }}
                        className={`min-h-[44px] lg:min-h-[38px] px-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                          rated === 3
                            ? 'bg-[#15803D] text-white border-[#15803D]'
                            : 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                        }`}
                      >
                        覚えた
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : isFinished ? (
        /* Session Completion Summary */
        <div className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-6 sm:p-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F0FDF4] text-[#15803D] mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-serif font-bold text-[#1C1917]">
              セッション完了
            </h2>
            <p className="text-xs sm:text-sm text-[#57534E]">
              {totalAnswered}回評価 · 正答率 {accuracyPct}%
              {!config.recordToSrs && '（記録OFF）'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-2">
            {againCardIds.length > 0 && (
              <button
                type="button"
                onClick={handleRetryAgainCards}
                className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-5 text-sm font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                間違えた {againCardIds.length} 問を再挑戦
              </button>
            )}
            <button
              type="button"
              onClick={handleRestartAll}
              className="min-h-[48px] px-4 text-sm font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
            >
              もう一度周回
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              className="min-h-[48px] px-4 text-sm font-medium text-[#57534E] hover:text-[#1C1917] border border-[#E6E0D6] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap"
            >
              学習に戻る
            </button>
          </div>
        </div>
      ) : (
        /* Focused Single-Column Card Stage */
        currentCard &&
        currentProgress &&
        ratingPreviews && (
          <>
            {/* Thin progress bar */}
            <div className="h-1 w-full bg-[#E6E0D6] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#9A3412] transition-all duration-200"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((currentIndex / Math.max(1, queueIds.length)) * 100)
                  )}%`,
                }}
              />
            </div>

            {/* Pure Card Surface with Live Finger-Tracking Swipe */}
            <div
              onTouchStart={handleCardTouchStart}
              onTouchMove={handleCardTouchMove}
              onTouchEnd={handleCardTouchEnd}
              style={{
                transform:
                  swipeOffsetX !== 0
                    ? `translate3d(${swipeOffsetX}px, 0, 0) rotate(${swipeRotationDeg.toFixed(2)}deg)`
                    : undefined,
                transition: isSwiping ? 'none' : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className={`bg-white border rounded-2xl sm:rounded-xl overflow-hidden ${
                swipeFeedback === 'left'
                  ? 'border-[#DC2626] bg-[#FEF2F2]/40'
                  : swipeFeedback === 'right'
                    ? 'border-[#2563EB] bg-[#EFF6FF]/40'
                    : 'border-[#E6E0D6]'
              }`}
            >
              {/* Quiet Card Header: Number · Unit + Audio & Star */}
              <div className="px-4 sm:px-6 py-2 border-b border-[#F4F0E8] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#78716C] min-w-0">
                  <span className="font-mono tabular-nums text-[#57534E]">
                    No.{currentCard.number}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{currentCard.unit}</span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSpeak}
                    aria-label="音声読み上げ"
                    className={`min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                      isSpeaking
                        ? 'text-[#9A3412] bg-[#9A3412]/10'
                        : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4F0E8]'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleStar(currentCard.id)}
                    aria-label="ブックマーク"
                    aria-pressed={Boolean(currentCard.starred)}
                    className={`min-h-[42px] min-w-[42px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                      currentCard.starred
                        ? 'text-[#B45309] bg-[#FFFBEB]'
                        : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#F4F0E8]'
                    }`}
                  >
                    <Star
                      className={`w-4 h-4 ${currentCard.starred ? 'fill-current' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Swipe directional banner */}
              {swipeFeedback && (
                <div
                  className={`px-4 py-1.5 text-center text-xs font-semibold ${
                    swipeFeedback === 'left'
                      ? 'bg-[#FEF2F2] text-[#991B1B]'
                      : 'bg-[#EFF6FF] text-[#1E40AF]'
                  }`}
                >
                  {swipeFeedback === 'left'
                    ? '← 離すと「もう一度」'
                    : '離すと「普通」 →'}
                </div>
              )}

              {/* Question & Answer Canvas */}
              <div className="p-5 sm:p-8 min-h-[230px] sm:min-h-[290px] flex flex-col justify-between gap-5">
                {config.mode === 'flip' ? (
                  <button
                    type="button"
                    onClick={() => setIsFlipped((prev) => !prev)}
                    aria-label={isFlipped ? '解答を隠す' : 'タップして解答を表示'}
                    className="w-full text-left space-y-3.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9A3412] rounded-lg"
                  >
                    <p className="text-[19px] sm:text-2xl font-serif font-semibold text-[#1C1917] leading-relaxed">
                      {promptText}
                    </p>

                    {!isFlipped && (
                      <div className="text-xs text-[#A8A29E] sm:hidden">
                        問題文をタップしても解答を表示できます
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3.5">
                    <p className="text-[19px] sm:text-2xl font-serif font-semibold text-[#1C1917] leading-relaxed">
                      {promptText}
                    </p>
                  </div>
                )}

                {showHint && !isFlipped && (
                  <div className="text-xs text-[#9A3412] bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg px-3.5 py-2 self-start">
                    ヒント：{hintText}
                  </div>
                )}

                {/* Typing Mode Input */}
                {config.mode === 'typing' && !isFlipped && (
                  <form
                    onSubmit={handleCheckTyping}
                    className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-[#F4F0E8]"
                  >
                    <input
                      ref={typingInputRef}
                      type="text"
                      value={typedAnswer}
                      onChange={(e) => setTypedAnswer(e.target.value)}
                      placeholder="解答を入力（空欄でEnterすると答えを表示）"
                      aria-label="解答を入力"
                      className="flex-1 h-12 sm:h-11 px-3.5 text-base sm:text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-xl sm:rounded-lg text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                    />
                    <button
                      type="submit"
                      className="hidden md:inline-flex items-center justify-center px-5 h-11 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      {typedAnswer.trim() ? '答え合わせ' : '答えを見る'}
                    </button>
                  </form>
                )}

                {/* Revealed Answer */}
                {isFlipped ? (
                  <div className="pt-4 border-t border-[#E6E0D6] space-y-3">
                    {config.mode === 'typing' && typingChecked && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span
                          className={
                            typingChecked.verdict === 'exact'
                              ? 'text-[#15803D] font-semibold'
                              : typingChecked.verdict === 'partial'
                                ? 'text-[#B45309] font-semibold'
                                : 'text-[#991B1B] font-semibold'
                          }
                        >
                          {typingChecked.verdict === 'exact'
                            ? '● 正解（Enterで次へ）'
                            : typingChecked.verdict === 'partial'
                              ? '▲ 部分一致（Enterで「難しい」）'
                              : typedAnswer.trim()
                                ? '✕ 不一致（Enterで「もう一度」）'
                                : '解答確認（Enterで「もう一度」）'}
                        </span>
                        {typedAnswer.trim() && (
                          <span className="text-[#78716C]">入力: {typedAnswer}</span>
                        )}
                      </div>
                    )}

                    <div className="text-[20px] sm:text-2xl font-serif font-bold text-[#9A3412] leading-relaxed">
                      {answerText}
                    </div>

                    {currentCard.note && (
                      <p className="text-xs text-[#57534E] bg-[#FBF9F5] rounded-lg px-3 py-2 leading-relaxed">
                        {currentCard.note}
                      </p>
                    )}

                    {currentCard.tags.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#78716C]">
                        {currentCard.tags.map((t, idx) => (
                          <span key={t} className="inline-flex items-center gap-2">
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>{parseTagMeta(t).displayLabel}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  config.mode === 'flip' && (
                    <div className="hidden md:flex pt-4 border-t border-[#F4F0E8] items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => setShowHint((prev) => !prev)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
                        >
                          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {showHint ? 'ヒントを隠す' : 'ヒント (H)'}
                        </button>
                        {canDefer && (
                          <button
                            type="button"
                            onClick={handleDeferCurrentCard}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#78716C] hover:text-[#1C1917] transition-colors"
                          >
                            <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                            あとで (S)
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsFlipped(true)}
                        className="px-7 py-2.5 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-lg transition-colors whitespace-nowrap"
                      >
                        解答を表示 (Space)
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Desktop 4-Stage SRS Rating Buttons */}
            {isFlipped && (
              <div className="hidden md:space-y-2 md:block">
                <div className="grid grid-cols-4 gap-2.5">
                  {RATING_BUTTONS.map((btn) => {
                    const isRecommended = recommendedTypingRating === btn.rating;
                    return (
                      <button
                        key={btn.rating}
                        type="button"
                        onClick={() => handleRate(btn.rating)}
                        className={`relative p-3.5 rounded-xl border text-center transition-all ${btn.baseClass} ${
                          isRecommended ? btn.recommendedRing : ''
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-[10px] font-mono opacity-65 border border-current/25 rounded px-1 leading-tight">
                            {btn.keyHint}
                          </span>
                          <span className="text-sm font-bold">{btn.label}</span>
                        </div>
                        <div className="mt-1 text-xs font-mono tabular-nums opacity-85">
                          {ratingPreviews[btn.rating]}
                        </div>
                        {isRecommended && (
                          <div className="mt-1 text-[10px] font-mono font-semibold opacity-90">
                            Enterで確定
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#78716C] px-1">
                  <span>← もう一度 · → 普通 · 1–4 評価 · Z 戻す</span>
                  {canDefer && (
                    <button
                      type="button"
                      onClick={handleDeferCurrentCard}
                      className="inline-flex items-center gap-1 hover:text-[#1C1917] transition-colors"
                    >
                      <SkipForward className="w-3 h-3" aria-hidden="true" />
                      評価せずあとで (S)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Fixed Thumb-Zone Action Dock (Compact <= 68px) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-md border-t border-[#E6E0D6] px-3 pt-2 pb-2.5 pb-safe">
              {!isFlipped ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowHint((prev) => !prev)}
                    aria-label={showHint ? 'ヒントを隠す' : 'ヒントを表示'}
                    className={`inline-flex items-center justify-center gap-1 min-h-[48px] px-3 text-xs font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 ${
                      showHint
                        ? 'bg-[#1C1917] text-[#FBF9F5]'
                        : 'text-[#57534E] bg-[#F4F0E8] active:bg-[#E6E0D6]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" aria-hidden="true" />
                    ヒント
                  </button>
                  {canDefer && (
                    <button
                      type="button"
                      onClick={handleDeferCurrentCard}
                      aria-label="この問題をあとで出題する"
                      className="inline-flex items-center justify-center gap-1 min-h-[48px] px-2.5 text-xs font-medium text-[#57534E] bg-[#F4F0E8] active:bg-[#E6E0D6] rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                      あとで
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      config.mode === 'typing' ? handleCheckTyping() : setIsFlipped(true)
                    }
                    className="flex-1 min-h-[48px] px-4 text-sm font-semibold text-[#FBF9F5] bg-[#1C1917] active:bg-[#9A3412] active:scale-[0.99] rounded-xl transition-all whitespace-nowrap"
                  >
                    {config.mode === 'typing'
                      ? typedAnswer.trim()
                        ? '答え合わせ'
                        : '答えを見る'
                      : '解答を表示'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {RATING_BUTTONS.map((btn) => {
                    const isRecommended = recommendedTypingRating === btn.rating;
                    return (
                      <button
                        key={btn.rating}
                        type="button"
                        onClick={() => handleRate(btn.rating)}
                        className={`min-h-[54px] px-1 py-1.5 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${btn.baseClass} ${
                          isRecommended ? btn.recommendedRing : ''
                        }`}
                      >
                        <span className="text-xs font-bold leading-tight whitespace-nowrap">
                          {btn.label}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums mt-0.5 opacity-90 whitespace-nowrap">
                          {ratingPreviews[btn.rating]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* Queue Jump Drawer (Jump to any question in current session) */}
      {isQueueOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="問題リストから移動"
          className="fixed inset-0 z-50 bg-[#1C1917]/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsQueueOpen(false)}
        >
          <div
            className="bg-[#FBF9F5] border-t sm:border border-[#E6E0D6] rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-lg max-h-[82dvh] flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 bg-[#D6CEBE] rounded-full" />
            </div>

            <div className="px-5 py-3.5 border-b border-[#E6E0D6] flex items-center justify-between">
              <div>
                <h3 className="text-base font-serif font-bold text-[#1C1917]">
                  問題リスト（全{queueIds.length}問）
                </h3>
                <p className="text-xs text-[#78716C]">
                  タップするとその問題へ直接移動します
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQueueOpen(false)}
                aria-label="問題リストを閉じる"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto archival-scroll divide-y divide-[#E6E0D6] bg-white">
              {queueIds.map((id, idx) => {
                const item = allCardsMap[id];
                if (!item) return null;
                const isCurrent = idx === currentIndex;
                const isPast = idx < currentIndex;
                const isAgain = againCardIds.includes(id);

                return (
                  <button
                    key={`${id}-${idx}`}
                    type="button"
                    onClick={() => handleJumpToIndex(idx)}
                    className={`w-full text-left px-4 py-3 flex items-start justify-between gap-3 transition-colors min-h-[54px] ${
                      isCurrent
                        ? 'bg-[#FFF7ED]'
                        : 'hover:bg-[#FBF9F5] active:bg-[#F4F0E8]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-[#78716C] font-mono tabular-nums">
                        <span className={isCurrent ? 'text-[#9A3412] font-bold' : ''}>
                          {idx + 1}.
                        </span>
                        <span>No.{item.number}</span>
                        {isCurrent && (
                          <span className="text-[#9A3412] font-sans font-semibold">
                            現在表示中
                          </span>
                        )}
                        {!isCurrent && isPast && (
                          <span className="text-[#15803D] font-sans">回答済</span>
                        )}
                        {isAgain && (
                          <span className="text-[#991B1B] font-sans">もう一度</span>
                        )}
                      </div>
                      <p className="text-sm text-[#1C1917] line-clamp-2 leading-snug">
                        {config.swapFrontBack ? item.back : item.front}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TIER 2: Settings, Options & Per-Card Forgetting Curve Sheet */}
      {isSettingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="学習設定と詳細"
          className="fixed inset-0 z-50 bg-[#1C1917]/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="bg-[#FBF9F5] border-t sm:border border-[#E6E0D6] rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md max-h-[88dvh] overflow-y-auto archival-scroll pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden flex justify-center pt-2.5 pb-1">
              <div className="w-10 h-1 bg-[#D6CEBE] rounded-full" />
            </div>

            <div className="px-5 py-3.5 border-b border-[#E6E0D6] flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#1C1917]">
                学習設定・詳細
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="閉じる"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* 1. Session Options */}
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[#57534E]">出題オプション</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleShuffleRemaining}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-[#1C1917] bg-white border border-[#E6E0D6] hover:border-[#1C1917] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                    残りをシャッフル
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleUpdateConfig({ swapFrontBack: !config.swapFrontBack });
                      setIsFlipped(false);
                    }}
                    className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      config.swapFrontBack
                        ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                        : 'bg-white text-[#1C1917] border-[#E6E0D6]'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                    表裏反転
                  </button>
                </div>

                <label className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-[#E6E0D6] rounded-lg text-xs text-[#1C1917] min-h-[46px] cursor-pointer">
                  <span>忘却曲線スケジュールに記録する</span>
                  <input
                    type="checkbox"
                    checked={config.recordToSrs}
                    onChange={(e) =>
                      handleUpdateConfig({ recordToSrs: e.target.checked })
                    }
                    className="accent-[#9A3412] w-5 h-5"
                  />
                </label>
              </div>

              {/* 2. Current Card Actions & Forgetting Curve Details */}
              {currentCard &&
                currentProgress &&
                config.mode !== 'redsheet' &&
                !isFinished && (
                  <>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-[#57534E]">
                        表示中の問題（No.{currentCard.number}）
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSettingsOpen(false);
                            onEditCard(currentCard);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-[#1C1917] bg-white border border-[#E6E0D6] hover:border-[#1C1917] rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                          問題を編集
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onToggleSuspend(currentCard.id);
                            setCurrentIndex((i) => i + 1);
                            resetCardInteractionState();
                            setIsSettingsOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg transition-colors whitespace-nowrap"
                        >
                          <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          出題を一時停止
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-[#E6E0D6] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#57534E]">
                          このカードの忘却曲線
                        </span>
                        <span className="font-mono tabular-nums text-[#9A3412]">
                          {getCardStatusLabel(currentProgress).label} · 保持{' '}
                          {calculateRetentionPercent(currentProgress) !== null
                            ? `${calculateRetentionPercent(currentProgress)}%`
                            : '—'}
                        </span>
                      </div>

                      <MiniCardCurveSvg progress={currentProgress} />

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F4F0E8] text-xs">
                        <div>
                          <span className="text-[#78716C]">学習 / 正解: </span>
                          <span className="font-mono tabular-nums text-[#1C1917]">
                            {currentProgress.totalReviews}/{currentProgress.correctReviews}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78716C]">次回: </span>
                          <span className="font-mono tabular-nums text-[#1C1917]">
                            {formatDueRelative(currentProgress.dueAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              {/* Desktop shortcut reference */}
              <div className="hidden md:block text-[11px] text-[#78716C] font-mono pt-1 leading-relaxed">
                Space/Enter: めくる・確定 · 1–4: 評価 · ←/→: もう一度/普通 · S: あとで · H: ヒント · B: 星 · Z: 戻す
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
