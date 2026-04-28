import { useState } from 'react';
import AppLayout from './AppLayout';

const CONTEXTS = ['interview', 'casual', 'presentation', 'random'];
const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

const DIFFICULTY_ACTIVE = {
  easy: 'bg-green-bg text-green-text',
  medium: 'bg-amber-bg text-amber-text',
  hard: 'bg-red-bg text-red-text',
  mixed: 'bg-surface text-text-primary',
};

function SegmentedControl({ options, value, onChange, colorize = false }) {
  return (
    <div className="flex p-[3px] bg-surface-raised border border-border rounded-lg overflow-x-auto flex-shrink-0">
      {options.map(opt => {
        const active = value === opt;
        const activeClass = colorize && active
          ? DIFFICULTY_ACTIVE[opt]
          : active
            ? 'bg-background border border-border shadow-sm text-text-primary'
            : 'text-text-secondary';
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-[12px] py-[6px] rounded-md text-label whitespace-nowrap transition-colors ${activeClass}`}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <h2 className="text-caption text-text-muted uppercase tracking-[0.08em] pl-[4px]">
      {children}
    </h2>
  );
}

function SettingRow({ label, description, children, border = true }) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-[16px] ${border ? 'pb-[20px] border-b border-border last:pb-0 last:border-0' : ''}`}>
      <div className="flex flex-col gap-[2px]">
        <span className="text-body-medium text-text-primary">{label}</span>
        {description && <span className="text-caption text-text-muted">{description}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex-shrink-0 w-[44px] h-[24px] rounded-full relative transition-colors ${checked ? 'bg-btn-primary-bg' : 'bg-border'}`}
    >
      <span
        className="absolute top-[2px] left-[2px] w-[20px] h-[20px] rounded-full bg-btn-primary-text shadow-sm transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}

export default function SettingsScreen() {
  const [difficulty, setDifficulty] = useState(
    () => localStorage.getItem('cadence_difficulty') || 'easy'
  );
  const [category, setCategory] = useState(
    () => localStorage.getItem('cadence_category') || 'random'
  );
  const [clearState, setClearState] = useState('idle'); // idle | confirm
  const [devPassword, setDevPassword] = useState('');
  const [devStatus, setDevStatus] = useState(
    () => localStorage.getItem('cadence_dev_mode') === 'true' ? 'active' : 'idle'
  );
  const [devLoading, setDevLoading] = useState(false);

  function updateDifficulty(val) {
    setDifficulty(val);
    localStorage.setItem('cadence_difficulty', val);
  }

  function updateCategory(val) {
    setCategory(val);
    localStorage.setItem('cadence_category', val);
  }

  async function handleDevUnlock() {
    if (!devPassword.trim() || devLoading) return;
    setDevLoading(true);
    try {
      const res = await fetch('/api/verify-dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: devPassword }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('cadence_dev_mode', 'true');
        localStorage.setItem('cadence_dev_token', devPassword);
        setDevStatus('active');
        setDevPassword('');
      } else {
        setDevStatus('wrong');
      }
    } catch {
      setDevStatus('wrong');
    } finally {
      setDevLoading(false);
    }
  }

  function handleDevLock() {
    localStorage.removeItem('cadence_dev_mode');
    localStorage.removeItem('cadence_dev_token');
    setDevStatus('idle');
    setDevPassword('');
  }

  function handleClear() {
    if (clearState === 'idle') {
      setClearState('confirm');
      return;
    }
    // Confirmed
    const keysToKeep = ['cadence_difficulty', 'cadence_category', 'cadence_device_id', 'cadence_mic_shown'];
    Object.keys(localStorage)
      .filter(k => k.startsWith('cadence_') && !keysToKeep.includes(k))
      .forEach(k => localStorage.removeItem(k));
    setClearState('idle');
  }

  return (
    <AppLayout title="Settings">
      <div className="pt-[32px] md:pt-[48px] max-w-[640px] flex flex-col gap-[32px]">

        {/* ROUND section */}
        <section className="flex flex-col gap-[8px]">
          <SectionHeader>Round</SectionHeader>
          <div className="bg-surface border border-border rounded-lg shadow-sm p-[20px] flex flex-col gap-[20px]">
            <SettingRow label="Context" description="The scenario you speak to">
              <SegmentedControl options={CONTEXTS} value={category} onChange={updateCategory} />
            </SettingRow>
            <SettingRow label="Difficulty" description="Words you'll be given" border={false}>
              <SegmentedControl options={DIFFICULTIES} value={difficulty} onChange={updateDifficulty} colorize />
            </SettingRow>
          </div>
        </section>

        {/* DEVELOPER section */}
        <section className="flex flex-col gap-[8px]">
          <SectionHeader>Developer</SectionHeader>
          <div className="bg-surface border border-border rounded-lg shadow-sm p-[20px] flex flex-col gap-[12px]">
            <div className="flex flex-col gap-[2px]">
              <span className="text-body-medium text-text-primary">Dev mode</span>
              <span className="text-caption text-text-muted">Unlock unlimited rounds for testing</span>
            </div>
            {devStatus === 'active' ? (
              <div className="flex items-center justify-between gap-[12px]">
                <span className="text-caption text-green-text">Dev mode active ✓</span>
                <button
                  onClick={handleDevLock}
                  className="flex-shrink-0 px-[12px] py-[8px] bg-surface-raised border border-border rounded-md text-label text-text-primary"
                >
                  Lock
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-[8px]">
                  <input
                    type="password"
                    value={devPassword}
                    onChange={e => { setDevPassword(e.target.value); if (devStatus === 'wrong') setDevStatus('idle'); }}
                    onKeyDown={e => e.key === 'Enter' && handleDevUnlock()}
                    placeholder="Enter password"
                    autoComplete="off"
                    className="flex-1 bg-surface-raised rounded-md px-[12px] py-[12px] text-body text-text-primary placeholder:text-text-muted border border-border focus:outline-none focus:ring-1 focus:ring-border"
                  />
                  <button
                    onClick={handleDevUnlock}
                    disabled={devLoading || !devPassword.trim()}
                    className="flex-shrink-0 px-[12px] py-[8px] bg-surface-raised border border-border rounded-md text-label text-text-primary disabled:opacity-50"
                  >
                    {devLoading ? '...' : 'Unlock'}
                  </button>
                </div>
                {devStatus === 'wrong' && (
                  <span className="text-caption text-red-text">Incorrect password</span>
                )}
              </>
            )}
          </div>
        </section>

        {/* DATA section */}
        <section className="flex flex-col gap-[8px]">
          <SectionHeader>Data</SectionHeader>
          <div className="bg-surface border border-border rounded-lg shadow-sm p-[20px]">
            <SettingRow label="Clear all rounds" description="Permanently deletes your scores and streaks" border={false}>
              {clearState === 'idle' ? (
                <button
                  onClick={handleClear}
                  className="flex-shrink-0 px-[16px] py-[8px] bg-surface-raised border border-border rounded-md text-label text-red-text hover:bg-red-bg transition-colors"
                >
                  Clear
                </button>
              ) : (
                <div className="flex items-center gap-[8px] flex-shrink-0">
                  <button
                    onClick={() => setClearState('idle')}
                    className="px-[12px] py-[8px] bg-surface-raised border border-border rounded-md text-label text-text-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-[12px] py-[8px] bg-red-bg border border-border rounded-md text-label text-red-text"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </SettingRow>
          </div>
        </section>

        {/* About — flat, no card */}
        <section className="pt-[32px] border-t border-border flex flex-col gap-[2px]">
          <span className="text-body-medium text-text-secondary">Cadence</span>
          <span className="text-caption text-text-muted">Version 1.0.0</span>
        </section>

      </div>
    </AppLayout>
  );
}
