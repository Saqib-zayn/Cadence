import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AppLayout from './AppLayout';
import { getRounds } from '../hooks/useLocalStorage';
import useStreak from '../hooks/useStreak';
import getAllRounderSummary from '../utils/allRounder';

const DIFFICULTIES = [
  { key: 'easy', label: 'Easy', fillClass: 'bg-green-mark', textClass: 'text-green-text' },
  { key: 'medium', label: 'Medium', fillClass: 'bg-amber-mark', textClass: 'text-amber-text' },
  { key: 'hard', label: 'Hard', fillClass: 'bg-red-mark', textClass: 'text-red-text' },
];

const FALLBACK_FILLERS = [
  { word: 'um', count: 0 },
  { word: 'like', count: 0 },
  { word: 'basically', count: 0 },
  { word: 'you know', count: 0 },
  { word: 'so', count: 0 },
];

function getScore(round = {}) {
  const score = round.fluencyScore ?? round.totalScore ?? round.score;
  const numeric = Number(score);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function getTimestamp(round = {}) {
  const timestamp = Number(round.timestamp || 0);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function average(values = []) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function formatStat(value) {
  return value > 0 ? String(value) : '--';
}

function getWeekStart(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay() || 7;
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day + 1);
  return start.getTime();
}

function addFiller(counts, word, count = 1) {
  const normalized = String(word || '').trim().toLowerCase();
  if (!normalized) return;
  counts.set(normalized, (counts.get(normalized) || 0) + count);
}

function getFillerBreakdown(rounds = []) {
  const counts = new Map();

  rounds.forEach((round) => {
    if (round.fillerWordCounts && typeof round.fillerWordCounts === 'object') {
      Object.entries(round.fillerWordCounts).forEach(([word, count]) => {
        addFiller(counts, word, Number(count) || 0);
      });
    }

    const found = round.fillerWordsFound || round.fillerWords || [];
    if (Array.isArray(found)) {
      found.forEach((entry) => {
        addFiller(counts, typeof entry === 'string' ? entry : entry?.word);
      });
    }
  });

  const sorted = [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return sorted.length > 0 ? sorted : FALLBACK_FILLERS;
}

function Card({ children, className = '' }) {
  return (
    <section
      className={`bg-surface border border-border rounded-lg p-[20px] md:p-[24px] xl:p-[32px] shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="bg-surface-raised border border-border rounded-sm px-[12px] py-[8px] min-w-[112px] flex flex-col">
      <span className="text-caption text-text-muted">{label}</span>
      <span className="text-body-medium text-text-primary">{value}</span>
    </div>
  );
}

function MetricCard({ icon, iconClass, value, label }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-[16px] md:p-[20px] xl:p-[24px] shadow-sm min-h-[156px] flex flex-col">
      <span className={`material-symbols-outlined ${iconClass}`} style={{ fontSize: '24px' }}>
        {icon}
      </span>
      <div className="mt-auto">
        <div className={`text-display md:text-[72px] xl:text-[88px] ${iconClass}`}>{value}</div>
        <div className="text-label text-text-muted mt-[4px]">{label}</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[180px] w-full rounded-md bg-surface-raised border border-border flex items-center justify-center px-[16px] text-center">
      <p className="text-caption text-text-muted">Complete a few rounds to see your score trend.</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-surface border border-border rounded-sm shadow-sm px-[12px] py-[8px]">
      <div className="text-caption text-text-muted">{label}</div>
      <div className="text-label text-text-primary">{payload[0].value} score</div>
    </div>
  );
}

export default function ProgressScreen() {
  const [range, setRange] = useState('last10');
  const { currentStreak, longestStreak } = useStreak();

  const rounds = useMemo(() => getRounds(), []);
  const chronologicalRounds = useMemo(
    () => [...rounds].sort((a, b) => getTimestamp(a) - getTimestamp(b)),
    [rounds],
  );

  const scoredRounds = chronologicalRounds.filter((round) => getScore(round) > 0);
  const scores = scoredRounds.map(getScore);
  const totalRounds = chronologicalRounds.length;
  const allTimeAverage = average(scores);
  const rollingAverage = average(scores.slice(-10));
  const personalBest = scores.length > 0 ? Math.max(...scores) : 0;
  const lastRoundScore = scores[scores.length - 1] || 0;
  const roundsThisWeek = chronologicalRounds.filter(
    (round) => getTimestamp(round) >= getWeekStart(),
  ).length;

  const chartRounds = range === 'last10' ? scoredRounds.slice(-10) : scoredRounds;
  const chartData = chartRounds.map((round) => ({
    name: `Round ${chronologicalRounds.indexOf(round) + 1}`,
    score: getScore(round),
  }));

  const fillerBreakdown = getFillerBreakdown(chronologicalRounds);
  const maxFillerCount = Math.max(...fillerBreakdown.map((item) => item.count), 1);
  const totalFillers = fillerBreakdown.reduce((sum, item) => sum + item.count, 0);
  const topFiller = fillerBreakdown.find((item) => item.count > 0);

  const allRounderSummary = getAllRounderSummary(chronologicalRounds);
  const strengths = allRounderSummary?.strengths?.length
    ? allRounderSummary.strengths
    : [{ message: 'Complete 10 rounds to unlock a reliable strength signal.' }];
  const weaknesses = allRounderSummary?.weaknesses?.length
    ? allRounderSummary.weaknesses
    : [{ message: 'Cadence will flag your clearest focus area as more rounds build up.' }];

  const difficultyRows = DIFFICULTIES.map((difficulty) => {
    const matchingRounds = chronologicalRounds.filter((round) => {
      const roundDifficulty = String(round.difficulty || round.word?.difficulty || '').toLowerCase();
      return roundDifficulty === difficulty.key;
    });
    const difficultyScores = matchingRounds.map(getScore).filter((score) => score > 0);

    return {
      ...difficulty,
      rounds: matchingRounds.length,
      average: average(difficultyScores),
    };
  });

  return (
    <AppLayout title="Progress" maxWidth="1200px">
      <div className="pt-[24px] md:pt-[40px] flex flex-col gap-[24px] md:gap-[32px]">
        <section className="flex flex-col gap-[8px]">
          <div className="flex items-center justify-between gap-[16px] flex-wrap">
            <h1 className="text-heading-1 md:text-[32px] xl:text-[36px] text-text-primary">
              Your Cadence
            </h1>
            <div className="flex items-center gap-[6px] bg-amber-bg px-[10px] py-[4px] rounded-full border border-border">
              <span className="material-symbols-outlined text-amber-text" style={{ fontSize: '16px' }}>
                local_fire_department
              </span>
              <span className="text-label text-text-primary">{currentStreak} day streak</span>
            </div>
          </div>
          <p className="text-caption text-text-muted">
            {totalRounds} rounds completed · Avg score {formatStat(allTimeAverage)}
          </p>
        </section>

        <div className="xl:grid xl:grid-cols-[45fr_55fr] xl:gap-[40px] space-y-[24px] md:space-y-[32px] xl:space-y-0">
          <div className="flex flex-col gap-[24px] md:gap-[32px]">
            <Card className="flex flex-col gap-[16px]">
              <div className="flex items-center justify-between gap-[16px] flex-wrap">
                <h2 className="text-heading-2 text-text-primary">Score trend</h2>
                <div className="flex bg-surface-raised rounded-full p-[4px] border border-border">
                  {[
                    { key: 'last10', label: 'Last 10' },
                    { key: 'all', label: 'All time' },
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setRange(option.key)}
                      className={`text-caption rounded-full px-[12px] py-[4px] transition-colors ${
                        range === option.key
                          ? 'bg-surface text-text-primary shadow-sm'
                          : 'text-text-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {chartData.length > 0 ? (
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: -24 }}>
                      <CartesianGrid stroke="#e2e2de" vertical={false} />
                      <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#a0a09a', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#3a6b3a"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#f0f0ed', stroke: '#3a6b3a', strokeWidth: 2 }}
                        activeDot={{ r: 4, fill: '#3a6b3a', stroke: '#3a6b3a' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart />
              )}

              <div className="flex gap-[8px] flex-wrap">
                <StatPill label="Rolling avg" value={formatStat(rollingAverage)} />
                <StatPill label="Personal best" value={formatStat(personalBest)} />
                <StatPill label="Last round" value={formatStat(lastRoundScore)} />
              </div>
            </Card>

            <section className="grid grid-cols-2 gap-[16px]">
              <MetricCard
                icon="local_fire_department"
                iconClass="text-amber-text"
                value={currentStreak}
                label={`day streak · best ${longestStreak}`}
              />
              <MetricCard
                icon="calendar_today"
                iconClass="text-green-text"
                value={roundsThisWeek}
                label="rounds this week"
              />
            </section>
          </div>

          <div className="flex flex-col gap-[24px] md:gap-[32px]">
            <Card className="flex flex-col gap-[16px]">
              <h2 className="text-heading-2 text-text-primary">Your filler words</h2>
              <div className="flex flex-col gap-[12px]">
                {fillerBreakdown.map((item) => (
                  <div key={item.word} className="flex items-center gap-[12px]">
                    <span className="text-label w-[72px] shrink-0 text-text-primary truncate">
                      {item.word}
                    </span>
                    <div className="flex-1 h-[8px] bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-mark rounded-full"
                        style={{
                          width: `${Math.max((item.count / maxFillerCount) * 100, item.count ? 8 : 0)}%`,
                        }}
                      />
                    </div>
                    <span className="text-caption text-red-text w-[28px] text-right font-medium">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-caption text-text-muted">
                {topFiller
                  ? `${topFiller.word} is your most common filler, with ${topFiller.count} of ${totalFillers} recorded uses.`
                  : 'No filler words recorded yet.'}
              </p>
            </Card>

            <Card className="flex flex-col gap-[16px]">
              <h2 className="text-heading-2 text-text-primary">All-rounder summary</h2>
              <div className="flex flex-col gap-[12px]">
                <h3 className="text-label text-text-muted uppercase tracking-[0.12em] text-[10px]">
                  Strengths
                </h3>
                {strengths.map((item) => (
                  <div key={item.type || item.message} className="flex items-start gap-[12px]">
                    <span className="w-[8px] h-[8px] rounded-full bg-green-mark mt-[8px] shrink-0" />
                    <p className="text-body-medium text-text-primary">{item.message}</p>
                  </div>
                ))}

                <div className="h-px w-full bg-border my-[4px]" />

                <h3 className="text-label text-text-muted uppercase tracking-[0.12em] text-[10px]">
                  Areas to focus
                </h3>
                {weaknesses.map((item) => (
                  <div key={item.type || item.message} className="flex items-start gap-[12px]">
                    <span className="w-[8px] h-[8px] rounded-full bg-amber-mark mt-[8px] shrink-0" />
                    <p className="text-body-medium text-text-primary">{item.message}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="flex flex-col gap-[16px]">
              <h2 className="text-heading-2 text-text-primary">Difficulty breakdown</h2>
              <div className="flex flex-col gap-[16px]">
                {difficultyRows.map((row) => (
                  <div key={row.key}>
                    <div className="flex justify-between items-center gap-[12px] mb-[4px]">
                      <span className="text-label text-text-primary">{row.label}</span>
                      <div className="flex items-center gap-[8px] flex-wrap justify-end">
                        <span className="text-caption text-text-muted">{row.rounds} rounds</span>
                        <span className={`text-label ${row.textClass}`}>
                          Avg {formatStat(row.average)}
                        </span>
                      </div>
                    </div>
                    <div className="h-[4px] bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className={`h-full ${row.fillClass} rounded-full`}
                        style={{ width: `${Math.max(row.average, row.rounds ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
