import { useState, useEffect } from 'react';
import { getWeeklyChallenge, recordWeeklyPlay } from '../utils/weeklyChallenge';
import AppLayout from './AppLayout';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const CATEGORIES = ['random', 'interview', 'casual', 'presentation'];

const DIFFICULTY_STYLES = {
  easy: 'bg-green-bg text-green-text',
  medium: 'bg-amber-bg text-amber-text',
  hard: 'bg-red-bg text-red-text',
};

const CATEGORY_LABELS = {
  random: 'Any context',
  interview: 'Interview',
  casual: 'Casual',
  presentation: 'Presentation',
};

function getStreak() {
  const count = parseInt(localStorage.getItem('cadence_streak_count') || '0', 10);
  const lastDay = localStorage.getItem('cadence_streak_date');
  if (!lastDay) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastDay !== today && lastDay !== yesterday) return 0;
  return count;
}

export default function HomeScreen({ onStartRound }) {
  const [difficulty, setDifficulty] = useState(
    () => localStorage.getItem('cadence_difficulty') || 'easy'
  );
  const [category, setCategory] = useState(
    () => localStorage.getItem('cadence_category') || 'random'
  );
  const [weeklyChallenge] = useState(() => getWeeklyChallenge());
  const [streak] = useState(() => getStreak());
  const [isFirstVisit] = useState(() => !localStorage.getItem('cadence_visited'));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('cadence_difficulty', difficulty);
  }, [difficulty]);

  useEffect(() => {
    localStorage.setItem('cadence_category', category);
  }, [category]);

  function cycleDifficulty() {
    setDifficulty(d => DIFFICULTIES[(DIFFICULTIES.indexOf(d) + 1) % DIFFICULTIES.length]);
  }

  function cycleCategory() {
    setCategory(c => CATEGORIES[(CATEGORIES.indexOf(c) + 1) % CATEGORIES.length]);
  }

  async function handleStart() {
    if (isLoading) return;
    setIsLoading(true);
    localStorage.setItem('cadence_visited', '1');
    await onStartRound(difficulty, category, false);
  }

  async function handleWeeklyChallenge() {
    if (isLoading) return;
    setIsLoading(true);
    localStorage.setItem('cadence_visited', '1');
    recordWeeklyPlay(weeklyChallenge.word);
    const wcWord = { word: weeklyChallenge.word, difficulty: 'hard', category: 'random' };
    await onStartRound('hard', 'random', false, wcWord);
  }

  return (
    <AppLayout>
      <div className="pt-[32px] md:pt-[48px] max-w-[600px]">

        {/* Wordmark + tagline */}
        <div className="mb-[32px]">
          <h1 className="text-heading-1 text-text-primary">Cadence</h1>
          {isFirstVisit ? (
            <p className="text-body text-text-secondary mt-[8px]">
              Get a word. Speak about it. See how you did.
            </p>
          ) : (
            <p className="text-body text-text-secondary mt-[4px]">Ready to speak?</p>
          )}
        </div>

        {/* Streak badge */}
        {!isFirstVisit && streak > 0 && (
          <div className="flex items-center gap-[8px] mb-[24px]">
            <div className="flex items-center gap-[6px] bg-amber-bg text-amber-text text-label px-[10px] py-[4px] rounded-full">
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>local_fire_department</span>
              {streak} day streak
            </div>
          </div>
        )}

        {/* Weekly challenge card */}
        <div className="bg-surface border border-border rounded-lg p-[20px] shadow-sm mb-[24px]">
          <div className="flex items-center gap-[8px] mb-[12px]">
            <span className="material-symbols-outlined text-amber-text" style={{ fontSize: '16px' }}>
              bolt
            </span>
            <span className="text-label text-text-secondary">Weekly Challenge</span>
          </div>
          <div className="flex items-start justify-between gap-[16px]">
            <div>
              <div className="text-heading-2 text-text-primary">{weeklyChallenge.word}</div>
              <div className="text-caption text-text-muted mt-[4px]">
                {weeklyChallenge.roundCount.toLocaleString()} rounds played this week
              </div>
            </div>
            <button
              onClick={handleWeeklyChallenge}
              disabled={isLoading}
              className="flex-shrink-0 h-[36px] px-[16px] bg-btn-secondary-bg text-btn-secondary-text text-label rounded-md whitespace-nowrap disabled:opacity-60"
            >
              {isLoading ? '...' : 'Play'}
            </button>
          </div>
        </div>

        {/* Settings pills */}
        <div className="flex items-center gap-[8px] mb-[24px] flex-wrap">
          <button
            onClick={cycleDifficulty}
            className={`text-label px-[10px] py-[4px] rounded-full ${DIFFICULTY_STYLES[difficulty]}`}
          >
            {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
          </button>
          <button
            onClick={cycleCategory}
            className="text-label px-[10px] py-[4px] rounded-full bg-surface-raised text-text-secondary"
          >
            {CATEGORY_LABELS[category]}
          </button>
          <span className="text-caption text-text-muted">tap to change</span>
        </div>

        {/* Start Round CTA */}
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full max-w-[360px] h-[52px] bg-btn-primary-bg text-btn-primary-text text-body-medium rounded-md disabled:opacity-60"
        >
          {isLoading ? 'Getting your word...' : isFirstVisit ? 'Start your first round' : 'Start Round'}
        </button>

        {isFirstVisit && (
          <p className="text-caption text-text-muted mt-[16px] max-w-[360px]">
            No account needed. Your data stays on your device.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
