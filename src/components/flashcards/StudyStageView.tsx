import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  HelpCircle,
  PauseCircle,
  RotateCcw,
  Shuffle,
  Star,
  Undo2,
  Volume2,
} from 'lucide-react';
import type {
  Flashcard,
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

interface StudyStageViewProps {
  config: StudySessionConfig;
  initialQueue: Flashcard[];
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
  onUpdateConfig: (patch: Partial<StudySessionConfig>) => void;
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
  subText: string;
  baseClass: string;
}> = [
  {
    rating: 1,
    keyHint: '1',
    label: 'もう一度',
    subText: '忘れた',
    baseClass:
      'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] active:scale-[0.98] hover:bg-[#FEE2E2] hover:border-[#DC2626]',
  },
  {
    rating: 2,
    keyHint: '2',
    label: '難しい',
    subText: '迷った',
    baseClass:
      'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] active:scale-[0.98] hover:bg-[#FEF3C7] hover:border-[#D97706]',
  },
  {
    rating: 3,
    keyHint: '3',
    label: '普通',
    subText: '正解',
    baseClass:
      'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF] active:scale-[0.98] hover:bg-[#DBEAFE] hover:border-[#2563EB]',
  },
  {
    rating: 4,
    keyHint: '4',
    label: '簡単',
    subText: '即答',
    baseClass:
      'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] active:scale-[0.98] hover:bg-[#DCFCE7] hover:border-[#16A34A]',
  },
];

function MiniCardCurveSvg({ progress }: { progress: SrsProgress }) {
  const stability = getMemoryStabilityDays(progress);
  const currentRetention = calculateRetentionPercent(progress) ?? 100;
  const horizonDays = Math.max(7, Math.min(60, Math.round(Math.max(progress.intervalDays * 1.8, 10))));

  const points: string[] = [];
  const width = 240;
  const height = 88;
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
      aria-label="このカードの忘却曲線予測グラフ"
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
        <circle cx={markerX} cy={markerY} r="3.5" fill="#9A3412" stroke="#FFFFFF" strokeWidth="1.5" />
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
  config,
  initialQueue,
  allCardsMap,
  srsMap,
  onRateCard,
  onUndoCardRate,
  onToggleStar,
  onToggleSuspend,
  onEditCard,
  onUpdateConfig,
  onMobileDockActiveChange,
  onBackToHub,
}: StudyStageViewProps) {
  const [queueIds, setQueueIds] = useState<string[]>(() => initialQueue.map((c) => c.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingChecked, setTypingChecked] = useState<null | {
    verdict: 'exact' | 'partial' | 'mismatch';
    coreExpected: string;
  }>(null);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);

  // Touch swipe tracking for one-handed mobile flashcards
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState<'left' | 'right' | null>(null);

  // Red-sheet mode state
  const [redSheetHideAll, setRedSheetHideAll] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [redSheetRated, setRedSheetRated] = useState<Record<string, SrsRating>>({});

  // Session telemetry
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [ratingCounts, setRatingCounts] = useState<Record<SrsRating, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });
  const [againCardIds, setAgainCardIds] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const typingInputRef = useRef<HTMLInputElement | null>(null);

  const queueSignature = useMemo(
    () => initialQueue.map((c) => c.id).join(','),
    [initialQueue]
  );

  useEffect(() => {
    setQueueIds(initialQueue.map((c) => c.id));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setTypedAnswer('');
    setTypingChecked(null);
    setUndoStack([]);
    setRatingCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setAgainCardIds([]);
    setRevealedIds({});
    setRedSheetRated({});
  }, [queueSignature, initialQueue]);

  const currentCardId = queueIds[currentIndex];
  const currentCard = currentCardId ? allCardsMap[currentCardId] : undefined;
  const isFinished = queueIds.length > 0 && currentIndex >= queueIds.length;

  // Notify parent workspace when the mobile thumb-zone action dock should replace bottom nav
  const shouldUseMobileDock =
    config.mode !== 'redsheet' &&
    initialQueue.length > 0 &&
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
      setIsFlipped(false);
      setShowHint(false);
      setTypedAnswer('');
      setTypingChecked(null);
      setSwipeFeedback(null);
    },
    [currentCard, onRateCard, config.recordToSrs, queueIds, currentIndex]
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
  }, [undoStack, onUndoCardRate]);

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
    setIsFlipped(false);
    setShowHint(false);
    setTypedAnswer('');
    setTypingChecked(null);
  };

  const handleRetryAgainCards = () => {
    if (againCardIds.length === 0) return;
    setQueueIds([...againCardIds]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setTypedAnswer('');
    setTypingChecked(null);
    setAgainCardIds([]);
    setRatingCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setUndoStack([]);
  };

  const handleRestartAll = () => {
    setQueueIds(initialQueue.map((c) => c.id));
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setTypedAnswer('');
    setTypingChecked(null);
    setAgainCardIds([]);
    setRatingCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setUndoStack([]);
  };

  // Touch swipe handlers for Flip card surface
  const handleCardTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (config.mode !== 'flip') return;
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleCardTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (config.mode !== 'flip' || !isFlipped || !touchStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      setSwipeFeedback(dx < 0 ? 'left' : 'right');
    } else {
      setSwipeFeedback(null);
    }
  };

  const handleCardTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (config.mode !== 'flip' || !touchStartRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      setSwipeFeedback(null);
      return;
    }
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (isFlipped && Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      handleRate(dx < 0 ? 1 : 3);
      return;
    }
    setSwipeFeedback(null);
  };

  // Keyboard shortcuts for desktop
  useEffect(() => {
    if (config.mode === 'redsheet' || isFinished || !currentCard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
        }
      } else if (isFlipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(Number(e.key) as SrsRating);
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowHint((prev) => !prev);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        onToggleStar(currentCard.id);
      } else if ((e.key === 'z' || e.key === 'Z') && undoStack.length > 0) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config.mode, isFinished, currentCard, isFlipped, handleRate, onToggleStar, undoStack.length, handleUndo]);

  useEffect(() => {
    if (config.mode === 'typing' && !isFlipped && !isFinished) {
      // Avoid forcing virtual keyboard pop-up unexpectedly on narrow mobile viewports unless user taps
      if (window.innerWidth >= 768) {
        typingInputRef.current?.focus();
      }
    }
  }, [config.mode, currentIndex, isFlipped, isFinished]);

  const totalAnswered =
    ratingCounts[1] + ratingCounts[2] + ratingCounts[3] + ratingCounts[4];
  const accuracyPct =
    totalAnswered > 0
      ? Math.round(((ratingCounts[2] + ratingCounts[3] + ratingCounts[4]) / totalAnswered) * 100)
      : 0;

  // Empty queue state
  if (initialQueue.length === 0) {
    return (
      <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-8 sm:p-10 text-center space-y-4">
        <h2 className="text-xl font-serif font-bold text-[#1C1917]">
          該当する問題がありません
        </h2>
        <p className="text-sm text-[#57534E] max-w-md mx-auto">
          現在選択されている条件（復習待ち・タグ・単元）に一致するカードは0件です。条件を変更するか、「全問演習」で学習できます。
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 py-2.5 text-sm font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            学習ハブへ戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top Study Session Bar */}
      <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center justify-center gap-1 min-h-[40px] px-3 text-xs font-medium text-[#57534E] hover:text-[#1C1917] bg-[#F4F0E8] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              戻る
            </button>
            <div className="min-w-0">
              <div className="text-sm font-serif font-bold text-[#1C1917] truncate">
                {config.label || '一問一答演習'}
              </div>
              <div className="text-xs text-[#78716C] font-mono tabular-nums">
                {config.mode === 'redsheet'
                  ? `一覧 ${initialQueue.length} 問`
                  : isFinished
                    ? `完了 ${totalAnswered} 回評価`
                    : `${Math.min(currentIndex + 1, queueIds.length)} / ${queueIds.length} 枚目`}
              </div>
            </div>
          </div>

          {/* Mobile quick undo in header */}
          {config.mode !== 'redsheet' && !isFinished && undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              aria-label="1つ前の問題に戻す"
              className="sm:hidden inline-flex items-center justify-center min-h-[40px] min-w-[40px] text-[#57534E] bg-[#F4F0E8] rounded-lg shrink-0"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3 Mode Switcher (Full-width 3-column grid on mobile for easy thumb tap) */}
        <div
          role="tablist"
          aria-label="学習モード切替"
          className="grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-[#F4F0E8] rounded-lg shrink-0"
        >
          {(
            [
              { id: 'flip', label: 'カード', desktopLabel: 'フラッシュカード' },
              { id: 'typing', label: '記述', desktopLabel: '記述チェック' },
              { id: 'redsheet', label: '赤シート', desktopLabel: '赤シート' },
            ] as Array<{ id: StudyMode; label: string; desktopLabel: string }>
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={config.mode === m.id}
              onClick={() => {
                onUpdateConfig({ mode: m.id });
                setIsFlipped(false);
                setTypingChecked(null);
              }}
              className={`min-h-[38px] sm:min-h-[32px] px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                config.mode === m.id
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <span className="sm:hidden">{m.label}</span>
              <span className="hidden sm:inline">{m.desktopLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode 3: Red Sheet Rapid List Mode */}
      {config.mode === 'redsheet' ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-3.5 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#57534E]">
              赤いシートをタップして解答を確認し、そのまま「要復習／覚えた」を忘却曲線へ記録できます。
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setRedSheetHideAll((prev) => !prev);
                  setRevealedIds({});
                }}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg sm:rounded-md transition-colors whitespace-nowrap"
              >
                {redSheetHideAll ? (
                  <>
                    <Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                    すべて表示
                  </>
                ) : (
                  <>
                    <EyeOff className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                    すべて隠す
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateConfig({ swapFrontBack: !config.swapFrontBack })
                }
                className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-3 py-2 sm:py-1.5 text-xs font-medium rounded-lg sm:rounded-md border transition-colors whitespace-nowrap ${
                  config.swapFrontBack
                    ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                    : 'bg-white text-[#57534E] border-[#D6CEBE] hover:text-[#1C1917]'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                表裏反転
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg divide-y divide-[#E6E0D6]">
            {initialQueue.map((card) => {
              const isRevealed = !redSheetHideAll || Boolean(revealedIds[card.id]);
              const rated = redSheetRated[card.id];
              const qText = config.swapFrontBack ? card.back : card.front;
              const aText = config.swapFrontBack ? card.front : card.back;
              const prog = getSrsProgress(srsMap, card.id);
              const status = getCardStatusLabel(prog);

              return (
                <div
                  key={card.id}
                  className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-start"
                >
                  <div className="lg:col-span-6 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-[#78716C]">
                      <span className="font-mono tabular-nums text-[#1C1917] font-medium">
                        No.{card.number}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{card.unit}</span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0">{status.label}</span>
                    </div>
                    <p className="text-[15px] text-[#1C1917] leading-relaxed">
                      {qText}
                    </p>
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
                      className={`w-full text-left px-4 py-3 rounded-lg sm:rounded-md border transition-colors min-h-[48px] active:scale-[0.99] ${
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

                  <div className="lg:col-span-2 grid grid-cols-[44px_1fr_1fr] lg:flex items-center justify-end gap-2 lg:gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleStar(card.id)}
                      aria-label="ブックマーク切替"
                      className={`min-h-[44px] lg:min-h-[36px] min-w-[44px] lg:min-w-[36px] flex items-center justify-center rounded-lg sm:rounded-md border transition-colors ${
                        card.starred
                          ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                          : 'bg-white border-[#E6E0D6] text-[#78716C] hover:text-[#1C1917]'
                      }`}
                    >
                      <Star
                        className={`w-4 h-4 ${card.starred ? 'fill-current' : ''}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRateCard(card.id, 1, config.recordToSrs);
                        setRedSheetRated((prev) => ({ ...prev, [card.id]: 1 }));
                      }}
                      className={`min-h-[44px] lg:min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg sm:rounded-md border transition-colors whitespace-nowrap ${
                        rated === 1
                          ? 'bg-[#DC2626] text-white border-[#DC2626]'
                          : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] hover:bg-[#FEE2E2]'
                      }`}
                    >
                      要復習
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onRateCard(card.id, 3, config.recordToSrs);
                        setRedSheetRated((prev) => ({ ...prev, [card.id]: 3 }));
                      }}
                      className={`min-h-[44px] lg:min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg sm:rounded-md border transition-colors whitespace-nowrap ${
                        rated === 3
                          ? 'bg-[#15803D] text-white border-[#15803D]'
                          : 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                      }`}
                    >
                      覚えた
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : isFinished ? (
        /* Session Completion Summary */
        <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-6 sm:p-10 max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#F0FDF4] text-[#15803D] mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-serif font-bold text-[#1C1917]">
              セッション完了
            </h2>
            <p className="text-sm text-[#57534E]">
              {config.recordToSrs
                ? 'すべての評価を忘却曲線スケジュールへ反映しました。'
                : '集中演習モード（SRSスケジュール未変更）を完了しました。'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E6E0D6]">
            <div className="p-3 bg-[#FBF9F5] rounded-lg">
              <div className="text-xs text-[#78716C]">総解答数</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#1C1917] mt-0.5">
                {totalAnswered}
              </div>
            </div>
            <div className="p-3 bg-[#FBF9F5] rounded-lg">
              <div className="text-xs text-[#78716C]">正答率</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#15803D] mt-0.5">
                {accuracyPct}%
              </div>
            </div>
            <div className="p-3 bg-[#FEF2F2] rounded-lg">
              <div className="text-xs text-[#991B1B]">もう一度</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#991B1B] mt-0.5">
                {ratingCounts[1]}
              </div>
            </div>
            <div className="p-3 bg-[#F0FDF4] rounded-lg">
              <div className="text-xs text-[#166534]">普通・簡単</div>
              <div className="text-xl font-mono font-semibold tabular-nums text-[#166534] mt-0.5">
                {ratingCounts[3] + ratingCounts[4]}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-2">
            {againCardIds.length > 0 && (
              <button
                type="button"
                onClick={handleRetryAgainCards}
                className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-5 py-2.5 text-sm font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                間違えた {againCardIds.length} 問を再挑戦
              </button>
            )}
            <button
              type="button"
              onClick={handleRestartAll}
              className="min-h-[48px] px-4 py-2.5 text-sm font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg transition-colors whitespace-nowrap"
            >
              もう一度周回する
            </button>
            <button
              type="button"
              onClick={onBackToHub}
              className="min-h-[48px] px-4 py-2.5 text-sm font-medium text-[#57534E] hover:text-[#1C1917] border border-[#D6CEBE] rounded-lg transition-colors whitespace-nowrap"
            >
              学習ハブへ戻る
            </button>
          </div>
        </div>
      ) : (
        /* Active 2-Zone Sandbox Stage (Desktop 8+4 cols / Mobile full-bleed card + Fixed Thumb Dock) */
        currentCard &&
        currentProgress &&
        ratingPreviews && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
              {/* Left 8 cols: Interactive Card Stage */}
              <div className="lg:col-span-8 space-y-4">
                {/* Thin session progress bar */}
                <div className="h-1.5 w-full bg-[#E6E0D6] rounded-full overflow-hidden">
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

                {/* Card Container (Tappable & Swipeable on mobile) */}
                <div
                  onTouchStart={handleCardTouchStart}
                  onTouchMove={handleCardTouchMove}
                  onTouchEnd={handleCardTouchEnd}
                  className={`bg-white border rounded-2xl sm:rounded-lg shadow-xs overflow-hidden transition-colors ${
                    swipeFeedback === 'left'
                      ? 'border-[#DC2626] bg-[#FEF2F2]/40'
                      : swipeFeedback === 'right'
                        ? 'border-[#2563EB] bg-[#EFF6FF]/40'
                        : 'border-[#D6CEBE]'
                  }`}
                >
                  {/* Clean Unboxed Metadata Header */}
                  <div className="px-4 sm:px-7 py-2.5 sm:py-3.5 bg-[#FBF9F5] border-b border-[#E6E0D6] flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#57534E] min-w-0">
                      <span className="font-mono font-semibold tabular-nums text-[#1C1917]">
                        No.{currentCard.number}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[155px] sm:max-w-[360px]">
                        {currentCard.unit}
                      </span>
                      <span className="hidden sm:inline" aria-hidden="true">
                        ·
                      </span>
                      <span className="hidden sm:inline text-[#78716C]">
                        {getCardStatusLabel(currentProgress).label}
                      </span>
                    </div>

                    {/* Card Utility Actions (>= 44px touch targets on mobile) */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleSpeak}
                        aria-label="音声読み上げ"
                        title="音声読み上げ"
                        className={`min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                          isSpeaking
                            ? 'bg-[#9A3412]/10 text-[#9A3412]'
                            : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8]'
                        }`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStar(currentCard.id)}
                        aria-label="ブックマーク"
                        title="ブックマーク (B)"
                        className={`min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center rounded-lg transition-colors ${
                          currentCard.starred
                            ? 'text-[#B45309] bg-[#FFFBEB]'
                            : 'text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8]'
                        }`}
                      >
                        <Star
                          className={`w-4 h-4 ${currentCard.starred ? 'fill-current' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditCard(currentCard)}
                        aria-label="この問題を編集"
                        title="この問題を編集"
                        className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center text-[#57534E] hover:text-[#1C1917] hover:bg-[#F4F0E8] rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onToggleSuspend(currentCard.id);
                          setCurrentIndex((i) => i + 1);
                          setIsFlipped(false);
                        }}
                        aria-label="この問題を出題停止にする"
                        title="出題一時停止"
                        className="hidden sm:flex min-h-[36px] min-w-[36px] items-center justify-center text-[#57534E] hover:text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg transition-colors"
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Swipe directional overlay hint */}
                  {swipeFeedback && (
                    <div
                      className={`px-4 py-1.5 text-center text-xs font-medium ${
                        swipeFeedback === 'left'
                          ? 'bg-[#FEF2F2] text-[#991B1B]'
                          : 'bg-[#EFF6FF] text-[#1E40AF]'
                      }`}
                    >
                      {swipeFeedback === 'left'
                        ? '← 離すと「もう一度」で記録'
                        : '離すと「普通」で記録 →'}
                    </div>
                  )}

                  {/* Main Question & Answer Stage (Tap surface to reveal answer in Flip mode) */}
                  <div
                    onClick={() => {
                      if (config.mode === 'flip' && !isFlipped) {
                        setIsFlipped(true);
                      }
                    }}
                    className={`p-5 sm:p-10 min-h-[240px] sm:min-h-[320px] flex flex-col justify-between gap-5 sm:gap-6 ${
                      config.mode === 'flip' && !isFlipped ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-[#78716C]">
                        <span className="font-medium">
                          {config.swapFrontBack ? '裏面（用語・解答から出題）' : '問題'}
                        </span>
                        {config.mode === 'flip' && !isFlipped && (
                          <span className="md:hidden text-[11px] text-[#9A3412]">
                            カードをタップして解答表示
                          </span>
                        )}
                      </div>

                      <p className="text-[19px] sm:text-2xl font-serif font-semibold text-[#1C1917] leading-relaxed">
                        {promptText}
                      </p>

                      {showHint && !isFlipped && (
                        <div className="text-xs text-[#9A3412] bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg px-3.5 py-2.5 inline-block">
                          ヒント：{hintText}
                        </div>
                      )}
                    </div>

                    {/* Typing input area when in Typing mode */}
                    {config.mode === 'typing' && !isFlipped && (
                      <form
                        onSubmit={handleCheckTyping}
                        className="space-y-2.5 pt-4 border-t border-[#E6E0D6]"
                      >
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <input
                            ref={typingInputRef}
                            type="text"
                            value={typedAnswer}
                            onChange={(e) => setTypedAnswer(e.target.value)}
                            placeholder="解答を入力..."
                            className="flex-1 h-12 sm:h-11 px-3.5 text-base sm:text-sm bg-[#FBF9F5] border border-[#D6CEBE] rounded-lg sm:rounded-md text-[#1C1917] focus:outline-none focus:border-[#9A3412]"
                          />
                          <button
                            type="submit"
                            className="hidden md:inline-flex items-center justify-center px-5 h-11 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            答え合わせ
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Revealed Answer Area */}
                    {isFlipped ? (
                      <div className="pt-5 sm:pt-6 border-t border-[#E6E0D6] space-y-3 animate-fade-in">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-[#9A3412]">
                            {config.swapFrontBack ? '元の問題文' : '解答'}
                          </span>
                          {config.mode === 'typing' && typingChecked && (
                            <span
                              className={`text-xs font-medium ${
                                typingChecked.verdict === 'exact'
                                  ? 'text-[#15803D]'
                                  : typingChecked.verdict === 'partial'
                                    ? 'text-[#B45309]'
                                    : 'text-[#991B1B]'
                              }`}
                            >
                              {typingChecked.verdict === 'exact'
                                ? '● 一致（正解）'
                                : typingChecked.verdict === 'partial'
                                  ? '▲ 部分一致（確認して評価）'
                                  : '✕ 不一致（解答を確認）'}
                            </span>
                          )}
                        </div>

                        {config.mode === 'typing' && typedAnswer.trim() && (
                          <div className="text-xs text-[#57534E]">
                            あなたの入力：
                            <span className="font-medium text-[#1C1917] ml-1">
                              {typedAnswer}
                            </span>
                          </div>
                        )}

                        <div className="text-[20px] sm:text-2xl font-serif font-bold text-[#9A3412] leading-relaxed">
                          {answerText}
                        </div>

                        {currentCard.note && (
                          <div className="p-3 bg-[#FBF9F5] border border-[#E6E0D6] rounded-lg text-xs text-[#57534E] leading-relaxed">
                            メモ：{currentCard.note}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Desktop inline flip controls (on mobile these move to the Fixed Thumb Dock!) */
                      config.mode === 'flip' && (
                        <div className="hidden md:flex pt-6 border-t border-[#E6E0D6] items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHint((prev) => !prev);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#57534E] hover:text-[#1C1917] bg-[#F4F0E8] rounded-md transition-colors whitespace-nowrap"
                          >
                            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            {showHint ? 'ヒントを隠す' : 'ヒントを表示 (H)'}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsFlipped(true);
                            }}
                            className="px-8 py-3 text-sm font-medium text-[#FBF9F5] bg-[#1C1917] hover:bg-[#9A3412] rounded-md transition-colors whitespace-nowrap"
                          >
                            解答を表示する（Space）
                          </button>
                        </div>
                      )
                    )}

                    {/* Clean unboxed tags footer */}
                    {currentCard.tags.length > 0 && (
                      <div className="pt-3 border-t border-[#F4F0E8] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#78716C]">
                        {currentCard.tags.map((t, idx) => (
                          <span key={t} className="inline-flex items-center gap-2">
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>{parseTagMeta(t).displayLabel}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Desktop 4-Stage SM-2 Forgetting Curve Rating Bar */}
                {isFlipped && (
                  <div className="hidden md:block space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#57534E] px-1">
                      <span>記憶の定着度を評価（次回出題タイミングを自動調整）</span>
                      {!config.recordToSrs && (
                        <span className="text-[#B45309] font-medium">
                          ※ 集中演習中（スケジュール保存OFF）
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2.5">
                      {RATING_BUTTONS.map((btn) => (
                        <button
                          key={btn.rating}
                          type="button"
                          onClick={() => handleRate(btn.rating)}
                          className={`p-3.5 rounded-lg border text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A3412] ${btn.baseClass}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold">{btn.label}</span>
                            <span className="text-[11px] font-mono opacity-75">
                              [{btn.keyHint}]
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-1 text-xs">
                            <span className="opacity-80">{btn.subText}</span>
                            <span className="font-mono font-medium tabular-nums">
                              {ratingPreviews[btn.rating]}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile Collapsible Inspector Trigger */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setIsMobileInspectorOpen((prev) => !prev)}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-white border border-[#E6E0D6] rounded-xl flex items-center justify-between text-xs font-medium text-[#57534E]"
                  >
                    <span>
                      忘却曲線データ・セッション設定（保持率{' '}
                      <span className="font-mono tabular-nums text-[#9A3412]">
                        {calculateRetentionPercent(currentProgress) !== null
                          ? `${calculateRetentionPercent(currentProgress)}%`
                          : '新規'}
                      </span>
                      ）
                    </span>
                    {isMobileInspectorOpen ? (
                      <ChevronUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              {/* Right 4 cols: Live Memory Inspector & Session Controls (Always open on lg:, collapsible on mobile) */}
              <aside
                className={`lg:col-span-4 space-y-4 ${
                  isMobileInspectorOpen ? 'block' : 'hidden lg:block'
                }`}
              >
                {/* Per-Card Forgetting Curve Panel */}
                <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[#57534E]">
                      このカードの忘却曲線
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-[#9A3412] font-medium">
                      保持率{' '}
                      {calculateRetentionPercent(currentProgress) !== null
                        ? `${calculateRetentionPercent(currentProgress)}%`
                        : '新規'}
                    </span>
                  </div>

                  <MiniCardCurveSvg progress={currentProgress} />

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E6E0D6] text-xs">
                    <div>
                      <div className="text-[#78716C]">学習回数 / 正解</div>
                      <div className="font-mono tabular-nums text-[#1C1917] font-medium mt-0.5">
                        {currentProgress.totalReviews}回 / {currentProgress.correctReviews}回
                      </div>
                    </div>
                    <div>
                      <div className="text-[#78716C]">難易度係数 (Ease)</div>
                      <div className="font-mono tabular-nums text-[#1C1917] font-medium mt-0.5">
                        {currentProgress.easeFactor.toFixed(2)}x
                      </div>
                    </div>
                    <div>
                      <div className="text-[#78716C]">現在の復習間隔</div>
                      <div className="font-mono tabular-nums text-[#1C1917] font-medium mt-0.5">
                        {currentProgress.intervalDays > 0
                          ? `${Math.max(1, Math.round(currentProgress.intervalDays))}日`
                          : '未設定'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[#78716C]">次回復習予定</div>
                      <div className="font-mono tabular-nums text-[#1C1917] font-medium mt-0.5">
                        {formatDueRelative(currentProgress.dueAt)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Controls */}
                <div className="bg-white border border-[#E6E0D6] rounded-xl sm:rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-medium text-[#57534E]">セッション設定</h3>

                  <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleShuffleRemaining}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] lg:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] rounded-lg lg:rounded-md transition-colors whitespace-nowrap"
                    >
                      <Shuffle className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                      シャッフル
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig({ swapFrontBack: !config.swapFrontBack });
                        setIsFlipped(false);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] lg:min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-lg lg:rounded-md border transition-colors whitespace-nowrap ${
                        config.swapFrontBack
                          ? 'bg-[#1C1917] text-[#FBF9F5] border-[#1C1917]'
                          : 'bg-[#FBF9F5] text-[#1C1917] border-[#D6CEBE] hover:bg-[#F4F0E8]'
                      }`}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
                      表裏反転
                    </button>
                    <button
                      type="button"
                      disabled={undoStack.length === 0}
                      onClick={handleUndo}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] lg:min-h-[34px] px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-[#FBF9F5] hover:bg-[#F4F0E8] border border-[#D6CEBE] disabled:opacity-40 rounded-lg lg:rounded-md transition-colors whitespace-nowrap"
                    >
                      <Undo2 className="w-3.5 h-3.5 text-[#57534E]" aria-hidden="true" />
                      1つ戻す
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onToggleSuspend(currentCard.id);
                        setCurrentIndex((i) => i + 1);
                        setIsFlipped(false);
                      }}
                      className="lg:hidden inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 py-1.5 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg transition-colors whitespace-nowrap"
                    >
                      <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      出題停止
                    </button>
                  </div>

                  <label className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#E6E0D6] text-xs text-[#1C1917] min-h-[40px] cursor-pointer">
                    <span>評価を忘却曲線スケジュールに記録</span>
                    <input
                      type="checkbox"
                      checked={config.recordToSrs}
                      onChange={(e) =>
                        onUpdateConfig({ recordToSrs: e.target.checked })
                      }
                      className="accent-[#9A3412] w-5 h-5"
                    />
                  </label>

                  <div className="hidden lg:block pt-2 border-t border-[#E6E0D6] text-[11px] text-[#78716C] space-y-1">
                    <div className="font-medium text-[#57534E]">ショートカット</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
                      <span>Space: めくる</span>
                      <span>1–4: 評価</span>
                      <span>H: ヒント</span>
                      <span>B: 星</span>
                      <span>Z: 戻す</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* Mobile Fixed Thumb-Zone Study Action Dock (Flip / Check Answer / 4-Button SRS Rating) */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FBF9F5]/95 backdrop-blur-md border-t border-[#E6E0D6] px-3 pt-2.5 pb-3 pb-safe shadow-[0_-4px_16px_rgba(28,25,23,0.06)]">
              {!isFlipped ? (
                config.mode === 'flip' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHint((prev) => !prev)}
                      className="inline-flex items-center justify-center gap-1 min-h-[50px] px-3.5 text-xs font-medium text-[#57534E] bg-[#F4F0E8] active:bg-[#E6E0D6] rounded-xl transition-colors whitespace-nowrap shrink-0"
                    >
                      <HelpCircle className="w-4 h-4" aria-hidden="true" />
                      {showHint ? '隠す' : 'ヒント'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFlipped(true)}
                      className="flex-1 min-h-[50px] px-5 text-sm font-semibold text-[#FBF9F5] bg-[#1C1917] active:bg-[#9A3412] active:scale-[0.99] rounded-xl transition-all whitespace-nowrap"
                    >
                      解答を表示する
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHint((prev) => !prev)}
                      className="inline-flex items-center justify-center gap-1 min-h-[50px] px-3.5 text-xs font-medium text-[#57534E] bg-[#F4F0E8] rounded-xl whitespace-nowrap shrink-0"
                    >
                      <HelpCircle className="w-4 h-4" aria-hidden="true" />
                      ヒント
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckTyping()}
                      className="flex-1 min-h-[50px] px-5 text-sm font-semibold text-[#FBF9F5] bg-[#1C1917] active:bg-[#9A3412] rounded-xl transition-all whitespace-nowrap"
                    >
                      答え合わせをする
                    </button>
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#78716C] px-0.5">
                    <span>定着度を選択（左右スワイプでも評価可）</span>
                    {!config.recordToSrs && (
                      <span className="text-[#B45309] font-medium">記録OFF</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {RATING_BUTTONS.map((btn) => (
                      <button
                        key={btn.rating}
                        type="button"
                        onClick={() => handleRate(btn.rating)}
                        className={`min-h-[56px] px-1.5 py-2 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${btn.baseClass}`}
                      >
                        <span className="text-xs font-bold leading-tight whitespace-nowrap">
                          {btn.label}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums mt-0.5 opacity-90 whitespace-nowrap">
                          {ratingPreviews[btn.rating]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
