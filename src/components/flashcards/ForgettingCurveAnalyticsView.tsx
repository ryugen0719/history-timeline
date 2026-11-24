import { useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import type {
  DailyStudyLogsMap,
  ExamScope,
  Flashcard,
  SrsProgressMap,
  StudySessionConfig,
} from '../../types/flashcards';
import {
  buildChapterHierarchy,
  buildTagCategoryGroups,
} from '../../utils/flashcardFilter';
import {
  build14DayForecast,
  calculateRetentionPercent,
  getLocalDateKey,
  getSrsProgress,
  isCardDue,
  isCardMastered,
  isCardWeak,
} from '../../utils/srsEngine';

interface ForgettingCurveAnalyticsViewProps {
  scopes: ExamScope[];
  cards: Flashcard[];
  srsMap: SrsProgressMap;
  dailyLogs: DailyStudyLogsMap;
  activeScopeId: string;
  streakDays: number;
  onLaunchSession: (config: StudySessionConfig) => void;
}

function EbbinghausCurveChart({
  avgRetention,
  reviewCountStage,
}: {
  avgRetention: number | null;
  reviewCountStage: 1 | 2 | 3;
}) {
  const width = 620;
  const height = 220;
  const padL = 44;
  const padR = 18;
  const padT = 18;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxDays = 30;

  const toX = (day: number) => padL + (plotW * day) / maxDays;
  const toY = (pct: number) => padT + plotH * (1 - pct / 100);

  // Unreviewed Ebbinghaus decay curve (rapid forgetting: S ≈ 2.2 days)
  const unreviewedPoints = useMemo(() => {
    const pts: string[] = [];
    for (let d = 0; d <= maxDays; d += 0.5) {
      const pct = Math.max(12, 100 * Math.exp(-d / 2.2));
      pts.push(`${toX(d).toFixed(1)},${toY(pct).toFixed(1)}`);
    }
    return pts.join(' ');
  }, []);

  // Spaced Repetition reinforced curves (review at Day 1, Day 4, Day 12)
  const srsSegments = useMemo(() => {
    const segs: Array<{ points: string; reviewDay?: number }> = [];

    // Segment 0: Day 0 -> Day 1 (S = 2.2)
    const s0: string[] = [];
    for (let d = 0; d <= 1; d += 0.2) {
      s0.push(`${toX(d).toFixed(1)},${toY(100 * Math.exp(-d / 2.2)).toFixed(1)}`);
    }
    segs.push({ points: s0.join(' ') });

    // Segment 1: Day 1 -> Day 4 (or 30 if stage=1) with S = 8
    const end1 = reviewCountStage >= 2 ? 4 : maxDays;
    const s1: string[] = [];
    for (let d = 1; d <= end1; d += 0.25) {
      s1.push(`${toX(d).toFixed(1)},${toY(100 * Math.exp(-(d - 1) / 8)).toFixed(1)}`);
    }
    segs.push({ points: s1.join(' '), reviewDay: 1 });

    if (reviewCountStage >= 2) {
      const end2 = reviewCountStage >= 3 ? 12 : maxDays;
      const s2: string[] = [];
      for (let d = 4; d <= end2; d += 0.4) {
        s2.push(`${toX(d).toFixed(1)},${toY(100 * Math.exp(-(d - 4) / 22)).toFixed(1)}`);
      }
      segs.push({ points: s2.join(' '), reviewDay: 4 });
    }

    if (reviewCountStage >= 3) {
      const s3: string[] = [];
      for (let d = 12; d <= maxDays; d += 0.5) {
        s3.push(`${toX(d).toFixed(1)},${toY(100 * Math.exp(-(d - 12) / 55)).toFixed(1)}`);
      }
      segs.push({ points: s3.join(' '), reviewDay: 12 });
    }

    return segs;
  }, [reviewCountStage]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="エビングハウスの忘却曲線と間隔反復による記憶保持率の推移グラフ"
    >
      {/* Y-axis gridlines */}
      {[100, 80, 60, 40, 20, 0].map((pct) => {
        const y = toY(pct);
        return (
          <g key={pct}>
            <line
              x1={padL}
              y1={y}
              x2={width - padR}
              y2={y}
              stroke={pct === 80 ? '#D6CEBE' : '#EFECE6'}
              strokeWidth="1"
              strokeDasharray={pct === 80 ? '4 3' : undefined}
            />
            <text
              x={padL - 8}
              y={y + 3}
              textAnchor="end"
              fontSize="10"
              fill="#78716C"
              className="font-mono"
            >
              {pct}%
            </text>
          </g>
        );
      })}

      {/* Optimal 85% review threshold reference */}
      <text
        x={width - padR - 4}
        y={toY(80) - 5}
        textAnchor="end"
        fontSize="9"
        fill="#78716C"
      >
        復習推奨ライン（約80%）
      </text>

      {/* Unreviewed decay curve */}
      <polyline
        fill="none"
        stroke="#A8A29E"
        strokeWidth="2"
        strokeDasharray="5 4"
        points={unreviewedPoints}
      />

      {/* SRS reinforced curves */}
      {srsSegments.map((seg, idx) => (
        <g key={idx}>
          {seg.reviewDay !== undefined && (
            <line
              x1={toX(seg.reviewDay)}
              y1={toY(100)}
              x2={toX(seg.reviewDay)}
              y2={toY(0)}
              stroke="#9A3412"
              strokeOpacity="0.2"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}
          <polyline
            fill="none"
            stroke="#9A3412"
            strokeWidth="2.5"
            points={seg.points}
          />
          {seg.reviewDay !== undefined && (
            <circle
              cx={toX(seg.reviewDay)}
              cy={toY(100)}
              r="4"
              fill="#9A3412"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )}
        </g>
      ))}

      {/* User's current average retention horizontal marker */}
      {avgRetention !== null && (
        <g>
          <line
            x1={padL}
            y1={toY(avgRetention)}
            x2={width - padR}
            y2={toY(avgRetention)}
            stroke="#15803D"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <text
            x={padL + 6}
            y={toY(avgRetention) - 5}
            fontSize="10"
            fill="#15803D"
            fontWeight="600"
          >
            現在の平均記憶保持率: {avgRetention}%
          </text>
        </g>
      )}

      {/* X-axis ticks */}
      {[0, 1, 4, 7, 12, 20, 30].map((d) => (
        <text
          key={d}
          x={toX(d)}
          y={height - 10}
          textAnchor="middle"
          fontSize="10"
          fill="#78716C"
          className="font-mono"
        >
          {d === 0 ? '初回' : `${d}日`}
        </text>
      ))}
    </svg>
  );
}

export function ForgettingCurveAnalyticsView({
  scopes,
  cards,
  srsMap,
  dailyLogs,
  activeScopeId,
  streakDays,
  onLaunchSession,
}: ForgettingCurveAnalyticsViewProps) {
  const [curveStage, setCurveStage] = useState<1 | 2 | 3>(3);
  const nowMs = Date.now();

  const scopeCards = useMemo(
    () =>
      cards.filter(
        (c) => !c.suspended && (activeScopeId === 'all' || c.scopeId === activeScopeId)
      ),
    [cards, activeScopeId]
  );

  const maturity = useMemo(() => {
    let newCount = 0;
    let learning = 0;
    let review = 0;
    let mastered = 0;
    let due = 0;
    let weak = 0;
    let retSum = 0;
    let retCount = 0;

    for (const card of scopeCards) {
      const p = getSrsProgress(srsMap, card.id);
      if (p.state === 'new') {
        newCount += 1;
      } else {
        const r = calculateRetentionPercent(p, nowMs);
        if (r !== null) {
          retSum += r;
          retCount += 1;
        }
        if (isCardMastered(p)) {
          mastered += 1;
        } else if (p.state === 'review') {
          review += 1;
        } else {
          learning += 1;
        }
      }
      if (isCardDue(p, nowMs)) due += 1;
      if (isCardWeak(p, nowMs)) weak += 1;
    }

    return {
      total: scopeCards.length,
      newCount,
      learning,
      review,
      mastered,
      due,
      weak,
      avgRetention: retCount > 0 ? Math.round(retSum / retCount) : null,
    };
  }, [scopeCards, srsMap, nowMs]);

  const forecast = useMemo(
    () => build14DayForecast(scopeCards, srsMap, nowMs),
    [scopeCards, srsMap, nowMs]
  );

  const maxForecast = Math.max(1, ...forecast.map((f) => f.dueCount));

  const recent7Days = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const items = [];
    for (let i = 6; i >= 0; i--) {
      const dMs = nowMs - i * DAY_MS;
      const key = getLocalDateKey(dMs);
      const d = new Date(dMs);
      const log = dailyLogs[key];
      items.push({
        key,
        label: i === 0 ? '今日' : `${d.getMonth() + 1}/${d.getDate()}`,
        reviews: log?.reviews ?? 0,
        correct: log?.correct ?? 0,
      });
    }
    return items;
  }, [dailyLogs, nowMs]);

  const maxDailyReviews = Math.max(1, ...recent7Days.map((d) => d.reviews));

  const chapterGroups = useMemo(
    () => buildChapterHierarchy(scopeCards, srsMap, nowMs),
    [scopeCards, srsMap, nowMs]
  );

  const weakTags = useMemo(() => {
    const groups = buildTagCategoryGroups(scopeCards, srsMap, nowMs);
    const flat = groups
      .filter((g) => g.key !== 'lesson')
      .flatMap((g) => g.items);

    return flat
      .filter((t) => t.weak > 0 || (t.avgRetention !== null && t.avgRetention < 85))
      .sort(
        (a, b) =>
          b.weak - a.weak ||
          (a.avgRetention ?? 100) - (b.avgRetention ?? 100)
      )
      .slice(0, 8);
  }, [scopeCards, srsMap, nowMs]);

  const activeScopeName =
    activeScopeId === 'all'
      ? 'すべての考査範囲'
      : scopes.find((s) => s.id === activeScopeId)?.name ?? '選択中';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[#E6E0D6]">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1C1917]">
            忘却曲線と記憶定着レポート
          </h2>
          <p className="text-xs sm:text-sm text-[#57534E] mt-1">
            対象：{activeScopeName}（全 {maturity.total} 問） · 連続学習 {streakDays} 日
          </p>
        </div>
        {maturity.due > 0 && (
          <button
            type="button"
            onClick={() =>
              onLaunchSession({
                scopeId: activeScopeId,
                chapter: 'all',
                unit: 'all',
                selectedTags: [],
                tagMatchMode: 'and',
                filterPreset: 'due',
                orderMode: 'srs',
                swapFrontBack: false,
                recordToSrs: true,
                mode: 'flip',
                label: '今日の忘却曲線復習',
              })
            }
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[36px] px-4 py-2 text-xs font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl sm:rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            今日の復習待ち（{maturity.due}問）を開始
          </button>
        )}
      </div>

      {/* Top Row: Ebbinghaus Forgetting Curve + Maturity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
        <section className="lg:col-span-8 bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-serif font-bold text-[#1C1917]">
                エビングハウス忘却曲線と間隔反復（SRS）の効果
              </h3>
              <p className="text-xs text-[#78716C] mt-0.5">
                実線（朱色）：復習による記憶強化 · 破線（灰色）：復習しなかった場合の減衰
              </p>
            </div>
            <div
              role="group"
              aria-label="復習回数のシミュレーション"
              className="grid grid-cols-3 sm:flex items-center gap-1 p-1 sm:p-0.5 bg-[#F4F0E8] rounded-lg sm:rounded-md"
            >
              {([1, 2, 3] as const).map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setCurveStage(stage)}
                  className={`min-h-[38px] sm:min-h-[28px] px-2.5 py-1 text-xs font-medium rounded-md sm:rounded transition-colors whitespace-nowrap ${
                    curveStage === stage
                      ? 'bg-white text-[#1C1917] shadow-xs'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  復習{stage}回
                </button>
              ))}
            </div>
          </div>

          <EbbinghausCurveChart
            avgRetention={maturity.avgRetention}
            reviewCountStage={curveStage}
          />
        </section>

        <section className="lg:col-span-4 bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <h3 className="text-base font-serif font-bold text-[#1C1917]">
              記憶定着ステージ内訳
            </h3>

            {/* Stacked distribution bar */}
            <div className="h-3 w-full bg-[#F4F0E8] rounded-full overflow-hidden flex">
              {maturity.total > 0 && (
                <>
                  <div
                    className="bg-[#15803D] h-full"
                    style={{ width: `${(maturity.mastered / maturity.total) * 100}%` }}
                    title={`長期定着: ${maturity.mastered}`}
                  />
                  <div
                    className="bg-[#1D4ED8] h-full"
                    style={{ width: `${(maturity.review / maturity.total) * 100}%` }}
                    title={`定着中: ${maturity.review}`}
                  />
                  <div
                    className="bg-[#D97706] h-full"
                    style={{ width: `${(maturity.learning / maturity.total) * 100}%` }}
                    title={`学習中: ${maturity.learning}`}
                  />
                </>
              )}
            </div>

            <div className="space-y-2.5 pt-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#166534] font-medium">長期定着（間隔14日以上）</span>
                <span className="font-mono tabular-nums text-[#1C1917] font-semibold">
                  {maturity.mastered} 問
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#1E40AF] font-medium">定着中（間隔1〜13日）</span>
                <span className="font-mono tabular-nums text-[#1C1917] font-semibold">
                  {maturity.review} 問
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#92400E] font-medium">学習中・再学習</span>
                <span className="font-mono tabular-nums text-[#1C1917] font-semibold">
                  {maturity.learning} 問
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#78716C]">未学習（新規）</span>
                <span className="font-mono tabular-nums text-[#57534E]">
                  {maturity.newCount} 問
                </span>
              </div>
            </div>
          </div>

          {/* Past 7 Days Activity Mini Bar */}
          <div className="pt-4 border-t border-[#E6E0D6] space-y-2">
            <div className="text-xs font-medium text-[#57534E]">直近7日間の学習回数</div>
            <div className="grid grid-cols-7 gap-1.5 items-end h-20 pt-2">
              {recent7Days.map((d) => {
                const heightPct = Math.round((d.reviews / maxDailyReviews) * 100);
                return (
                  <div key={d.key} className="flex flex-col items-center gap-1 h-full justify-end">
                    <span className="text-[10px] font-mono tabular-nums text-[#78716C]">
                      {d.reviews > 0 ? d.reviews : ''}
                    </span>
                    <div className="w-full bg-[#F4F0E8] rounded-xs h-12 flex items-end overflow-hidden">
                      <div
                        className="w-full bg-[#1C1917] rounded-xs transition-all"
                        style={{ height: `${d.reviews > 0 ? Math.max(12, heightPct) : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#78716C] font-mono">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* 14-Day Scheduled Review Forecast (horizontally scrollable on narrow mobile screens) */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-serif font-bold text-[#1C1917]">
              今後14日間の復習予定スケジュール
            </h3>
            <p className="text-xs text-[#78716C]">
              各日に忘却曲線上の復習期限を迎える問題数の予測
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#57534E] shrink-0">
            計 {forecast.reduce((s, f) => s + f.dueCount, 0)} 問
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-14 gap-2 items-end h-32 pt-3 min-w-[520px] sm:min-w-0">
            {forecast.map((day) => {
              const hPct = Math.round((day.dueCount / maxForecast) * 100);
              return (
                <div
                  key={day.dateKey}
                  className="flex flex-col items-center justify-end gap-1 h-full"
                >
                  <span className="text-[10px] font-mono tabular-nums text-[#57534E]">
                    {day.dueCount > 0 ? day.dueCount : '0'}
                  </span>
                  <div className="w-full max-w-[32px] h-20 bg-[#F4F0E8] rounded-xs flex items-end overflow-hidden">
                    <div
                      className={`w-full rounded-xs transition-all ${
                        day.isToday ? 'bg-[#9A3412]' : 'bg-[#1C1917]/75'
                      }`}
                      style={{ height: `${day.dueCount > 0 ? Math.max(10, hPct) : 0}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono whitespace-nowrap ${
                      day.isToday ? 'text-[#9A3412] font-semibold' : 'text-[#78716C]'
                    }`}
                  >
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom 2-Column: Weak Tags + Unit Mastery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
        {/* Weak Tags */}
        <section className="lg:col-span-5 bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-4 sm:p-5 space-y-4">
          <h3 className="text-base font-serif font-bold text-[#1C1917]">
            弱点・要復習タグ
          </h3>
          {weakTags.length === 0 ? (
            <p className="text-xs text-[#78716C] leading-relaxed">
              学習を進めると、忘却回数の多いタグや記憶保持率が低下しているタグが自動でここに抽出されます。
            </p>
          ) : (
            <div className="divide-y divide-[#E6E0D6]">
              {weakTags.map((t) => (
                <div
                  key={t.meta.raw}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#1C1917] truncate">
                      {t.meta.categoryLabel}: {t.meta.displayLabel}
                    </div>
                    <div className="text-xs text-[#78716C] font-mono tabular-nums mt-0.5">
                      苦手 {t.weak}問 · 保持率{' '}
                      {t.avgRetention !== null ? `${t.avgRetention}%` : '—'} · 全{t.total}問
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchSession({
                        scopeId: activeScopeId,
                        chapter: 'all',
                        unit: 'all',
                        selectedTags: [t.meta.raw],
                        tagMatchMode: 'and',
                        filterPreset: t.weak > 0 ? 'weak' : 'all',
                        orderMode: 'srs',
                        swapFrontBack: false,
                        recordToSrs: true,
                        mode: 'flip',
                        label: `弱点タグ復習：${t.meta.displayLabel}`,
                      })
                    }
                    className="min-h-[40px] sm:min-h-[32px] px-3 py-1.5 text-xs font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg sm:rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    復習
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Unit Mastery List */}
        <section className="lg:col-span-7 bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-lg p-4 sm:p-5 space-y-4">
          <h3 className="text-base font-serif font-bold text-[#1C1917]">
            単元別の定着状況
          </h3>
          <div className="divide-y divide-[#E6E0D6]">
            {chapterGroups.flatMap((ch) =>
              ch.units.map((u) => {
                const learnedPct =
                  u.total > 0 ? Math.round((u.learned / u.total) * 100) : 0;
                return (
                  <div
                    key={`${ch.chapter}-${u.unit}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs font-medium text-[#1C1917] truncate">
                        {u.unit}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 bg-[#F4F0E8] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#15803D]"
                            style={{ width: `${learnedPct}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono tabular-nums text-[#57534E] w-20 text-right shrink-0">
                          {u.learned}/{u.total} ({learnedPct}%)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onLaunchSession({
                          scopeId: activeScopeId,
                          chapter: ch.chapter,
                          unit: u.unit,
                          selectedTags: [],
                          tagMatchMode: 'and',
                          filterPreset: u.due > 0 ? 'due' : 'all',
                          orderMode: 'srs',
                          swapFrontBack: false,
                          recordToSrs: true,
                          mode: 'flip',
                          label: u.unit,
                        })
                      }
                      className="min-h-[40px] sm:min-h-[30px] px-3 py-1 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg sm:rounded transition-colors whitespace-nowrap shrink-0"
                    >
                      演習
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
