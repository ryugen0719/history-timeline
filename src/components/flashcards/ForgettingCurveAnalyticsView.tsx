import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Play } from 'lucide-react';
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
  const height = 210;
  const padL = 44;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const maxDays = 30;

  const toX = (day: number) => padL + (plotW * day) / maxDays;
  const toY = (pct: number) => padT + plotH * (1 - pct / 100);

  const unreviewedPoints = useMemo(() => {
    const pts: string[] = [];
    for (let d = 0; d <= maxDays; d += 0.5) {
      const pct = Math.max(12, 100 * Math.exp(-d / 2.2));
      pts.push(`${toX(d).toFixed(1)},${toY(pct).toFixed(1)}`);
    }
    return pts.join(' ');
  }, []);

  const srsSegments = useMemo(() => {
    const segs: Array<{ points: string; reviewDay?: number }> = [];

    const s0: string[] = [];
    for (let d = 0; d <= 1; d += 0.2) {
      s0.push(`${toX(d).toFixed(1)},${toY(100 * Math.exp(-d / 2.2)).toFixed(1)}`);
    }
    segs.push({ points: s0.join(' ') });

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
      aria-label="エビングハウスの忘却曲線と間隔反復による記憶保持率"
    >
      {[100, 80, 50, 0].map((pct) => {
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

      <polyline
        fill="none"
        stroke="#A8A29E"
        strokeWidth="2"
        strokeDasharray="5 4"
        points={unreviewedPoints}
      />

      {srsSegments.map((seg, idx) => (
        <g key={idx}>
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
              r="3.5"
              fill="#9A3412"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )}
        </g>
      ))}

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
            現在の平均保持率: {avgRetention}%
          </text>
        </g>
      )}

      {[0, 1, 4, 12, 30].map((d) => (
        <text
          key={d}
          x={toX(d)}
          y={height - 8}
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
  const [showUnitsDetail, setShowUnitsDetail] = useState(false);
  const [showCurveModel, setShowCurveModel] = useState(false);

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
    }

    return {
      total: scopeCards.length,
      newCount,
      learning,
      review,
      mastered,
      due,
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
      });
    }
    return items;
  }, [dailyLogs, nowMs]);
  const maxDailyReviews = Math.max(1, ...recent7Days.map((d) => d.reviews));

  const chapterGroups = useMemo(
    () => buildChapterHierarchy(scopeCards, srsMap, nowMs),
    [scopeCards, srsMap, nowMs]
  );
  const allUnits = useMemo(
    () => chapterGroups.flatMap((ch) => ch.units),
    [chapterGroups]
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
          b.weak - a.weak || (a.avgRetention ?? 100) - (b.avgRetention ?? 100)
      )
      .slice(0, 6);
  }, [scopeCards, srsMap, nowMs]);

  const activeScopeName =
    activeScopeId === 'all'
      ? 'すべての考査範囲'
      : scopes.find((s) => s.id === activeScopeId)?.name ?? '選択中';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* TIER 1: Actionable Summary */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-serif font-bold text-[#1C1917]">
              記憶定着・復習スケジュール
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              {activeScopeName}（全 {maturity.total} 問）
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
                  label: '今日の復習',
                })
              }
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] px-4 text-xs font-semibold text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              今日の復習を開始（{maturity.due}問）
            </button>
          )}
        </div>

        {/* 3 Clean Key Metrics */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#F4F0E8]">
          <div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">平均記憶保持</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#15803D] mt-0.5">
              {maturity.avgRetention !== null ? `${maturity.avgRetention}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">長期定着</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#1C1917] mt-0.5">
              {maturity.mastered}
              <span className="text-xs font-normal text-[#78716C]">/{maturity.total}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] sm:text-xs text-[#78716C]">連続学習</div>
            <div className="text-xl sm:text-2xl font-mono font-semibold tabular-nums text-[#1C1917] mt-0.5">
              {streakDays}
              <span className="text-xs font-sans font-normal text-[#78716C] ml-0.5">日</span>
            </div>
          </div>
        </div>

        {/* Maturity Bar */}
        <div className="space-y-2 pt-3 border-t border-[#F4F0E8]">
          <div className="h-2.5 w-full bg-[#F4F0E8] rounded-full overflow-hidden flex">
            {maturity.total > 0 && (
              <>
                <div
                  className="bg-[#15803D] h-full"
                  style={{ width: `${(maturity.mastered / maturity.total) * 100}%` }}
                />
                <div
                  className="bg-[#1D4ED8] h-full"
                  style={{ width: `${(maturity.review / maturity.total) * 100}%` }}
                />
                <div
                  className="bg-[#D97706] h-full"
                  style={{ width: `${(maturity.learning / maturity.total) * 100}%` }}
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-[#57534E] font-mono tabular-nums">
            <span className="text-[#166534]">長期定着 {maturity.mastered}</span>
            <span className="text-[#1E40AF]">定着中 {maturity.review}</span>
            <span className="text-[#92400E]">学習中 {maturity.learning}</span>
            <span className="text-[#78716C]">未学習 {maturity.newCount}</span>
          </div>
        </div>
      </section>

      {/* TIER 1: 14-Day Scheduled Review Forecast */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-serif font-bold text-[#1C1917]">
            今後14日間の復習予定
          </h3>
          <span className="text-xs font-mono tabular-nums text-[#78716C]">
            計 {forecast.reduce((s, f) => s + f.dueCount, 0)} 問
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-14 gap-2 items-end h-28 pt-2 min-w-[500px] sm:min-w-0">
            {forecast.map((day) => {
              const hPct = Math.round((day.dueCount / maxForecast) * 100);
              return (
                <div
                  key={day.dateKey}
                  className="flex flex-col items-center justify-end gap-1 h-full"
                >
                  <span className="text-[10px] font-mono tabular-nums text-[#57534E]">
                    {day.dueCount > 0 ? day.dueCount : ''}
                  </span>
                  <div className="w-full max-w-[28px] h-16 bg-[#F4F0E8] rounded-xs flex items-end overflow-hidden">
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

      {/* TIER 1 (Conditional): Weak Tags Action List */}
      {weakTags.length > 0 && (
        <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl p-5 space-y-3">
          <h3 className="text-sm sm:text-base font-serif font-bold text-[#1C1917]">
            優先して復習したい弱点タグ
          </h3>
          <div className="divide-y divide-[#F4F0E8]">
            {weakTags.map((t) => (
              <div
                key={t.meta.raw}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#1C1917] truncate">
                    {t.meta.displayLabel}
                  </div>
                  <div className="text-xs text-[#78716C] font-mono tabular-nums">
                    苦手 {t.weak} · 保持{' '}
                    {t.avgRetention !== null ? `${t.avgRetention}%` : '—'}
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
                      label: `弱点復習：${t.meta.displayLabel}`,
                    })
                  }
                  className="min-h-[38px] px-3.5 text-xs font-medium text-[#FBF9F5] bg-[#9A3412] hover:bg-[#7C2D12] rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  復習
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TIER 2 (Collapsible): Unit Mastery Details */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowUnitsDetail((prev) => !prev)}
          aria-expanded={showUnitsDetail}
          className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left hover:bg-[#FBF9F5] transition-colors"
        >
          <span className="text-sm font-medium text-[#1C1917]">
            単元別の定着状況（{allUnits.length}単元）
          </span>
          {showUnitsDetail ? (
            <ChevronDown className="w-4 h-4 text-[#78716C]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#78716C]" />
          )}
        </button>

        {showUnitsDetail && (
          <div className="px-5 pb-4 border-t border-[#F4F0E8] divide-y divide-[#F4F0E8]">
            {allUnits.map((u) => {
              const learnedPct =
                u.total > 0 ? Math.round((u.learned / u.total) * 100) : 0;
              return (
                <div
                  key={`${u.chapter}-${u.unit}`}
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
                      <span className="text-xs font-mono tabular-nums text-[#57534E] w-16 text-right shrink-0">
                        {u.learned}/{u.total}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchSession({
                        scopeId: activeScopeId,
                        chapter: u.chapter,
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
                    className="min-h-[38px] px-3 text-xs font-medium text-[#1C1917] bg-[#F4F0E8] hover:bg-[#E6E0D6] rounded-lg whitespace-nowrap shrink-0"
                  >
                    演習
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* TIER 2 (Collapsible): 7-Day Activity & Ebbinghaus Theory Curve */}
      <section className="bg-white border border-[#E6E0D6] rounded-2xl sm:rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCurveModel((prev) => !prev)}
          aria-expanded={showCurveModel}
          className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left hover:bg-[#FBF9F5] transition-colors"
        >
          <span className="text-sm font-medium text-[#1C1917]">
            直近7日間の実績・忘却曲線モデル
          </span>
          {showCurveModel ? (
            <ChevronDown className="w-4 h-4 text-[#78716C]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#78716C]" />
          )}
        </button>

        {showCurveModel && (
          <div className="p-5 border-t border-[#F4F0E8] space-y-6">
            {/* Past 7 Days */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#57534E]">直近7日間の学習回数</div>
              <div className="grid grid-cols-7 gap-2 items-end h-20 pt-2 max-w-md">
                {recent7Days.map((d) => {
                  const heightPct = Math.round((d.reviews / maxDailyReviews) * 100);
                  return (
                    <div key={d.key} className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="text-[10px] font-mono tabular-nums text-[#78716C]">
                        {d.reviews > 0 ? d.reviews : ''}
                      </span>
                      <div className="w-full bg-[#F4F0E8] rounded-xs h-12 flex items-end overflow-hidden">
                        <div
                          className="w-full bg-[#1C1917] rounded-xs"
                          style={{ height: `${d.reviews > 0 ? Math.max(12, heightPct) : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#78716C] font-mono">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ebbinghaus Curve Reference */}
            <div className="space-y-3 pt-4 border-t border-[#F4F0E8]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-[#57534E]">
                  エビングハウス忘却曲線と間隔反復の効果
                </div>
                <div className="inline-flex items-center gap-1 p-1 bg-[#F4F0E8] rounded-lg self-start">
                  {([1, 2, 3] as const).map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setCurveStage(stage)}
                      className={`min-h-[30px] px-2.5 text-xs font-medium rounded-md transition-colors ${
                        curveStage === stage
                          ? 'bg-white text-[#1C1917] shadow-xs'
                          : 'text-[#57534E]'
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
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
