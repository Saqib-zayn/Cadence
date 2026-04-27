import { useState } from 'react';
import AppLayout from './AppLayout';

export default function SettingsScreen() {
  const [difficulty, setDifficulty] = useState(
    () => localStorage.getItem('cadence_difficulty') || 'easy'
  );
  const [category, setCategory] = useState(
    () => localStorage.getItem('cadence_category') || 'random'
  );
  const [challengeMode, setChallengeMode] = useState(
    () => localStorage.getItem('cadence_challenge_mode') === '1'
  );

  function updateDifficulty(val) {
    setDifficulty(val);
    localStorage.setItem('cadence_difficulty', val);
  }

  function updateCategory(val) {
    setCategory(val);
    localStorage.setItem('cadence_category', val);
  }

  function toggleChallengeMode() {
    const next = !challengeMode;
    setChallengeMode(next);
    localStorage.setItem('cadence_challenge_mode', next ? '1' : '0');
  }

  return (
    <AppLayout title="Settings">
      <div className="pt-[32px] md:pt-[48px] max-w-[520px] space-y-[24px]">

        {/* Difficulty */}
        <div>
          <div className="text-label text-text-secondary mb-[12px]">Difficulty</div>
          <div className="flex gap-[8px]">
            {['easy', 'medium', 'hard'].map(d => (
              <button
                key={d}
                onClick={() => updateDifficulty(d)}
                className={`h-[40px] px-[16px] rounded-md text-body-medium transition-colors ${
                  difficulty === d
                    ? 'bg-btn-primary-bg text-btn-primary-text'
                    : 'bg-btn-secondary-bg text-btn-secondary-text'
                }`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Context */}
        <div>
          <div className="text-label text-text-secondary mb-[12px]">Context</div>
          <div className="flex flex-wrap gap-[8px]">
            {['random', 'interview', 'casual', 'presentation'].map(c => (
              <button
                key={c}
                onClick={() => updateCategory(c)}
                className={`h-[40px] px-[16px] rounded-md text-body-medium transition-colors ${
                  category === c
                    ? 'bg-btn-primary-bg text-btn-primary-text'
                    : 'bg-btn-secondary-bg text-btn-secondary-text'
                }`}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Challenge mode */}
        <div className="bg-surface border border-border rounded-lg p-[20px] shadow-sm">
          <div className="flex items-start justify-between gap-[16px]">
            <div>
              <div className="text-body-medium text-text-primary">Challenge mode</div>
              <div className="text-caption text-text-muted mt-[4px]">
                Word appears after you hit record
              </div>
            </div>
            <button
              onClick={toggleChallengeMode}
              className={`flex-shrink-0 w-[44px] h-[24px] rounded-full relative transition-colors ${
                challengeMode ? 'bg-btn-primary-bg' : 'bg-border'
              }`}
              aria-checked={challengeMode}
              role="switch"
            >
              <span
                className="absolute top-[2px] left-[2px] w-[20px] h-[20px] rounded-full bg-btn-primary-text shadow-sm transition-transform"
                style={{ transform: challengeMode ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
