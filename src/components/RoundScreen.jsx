import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { generateContext } from '../utils/api';
import { storeAudio } from '../utils/audioStore';

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const BARS = 18;

const DIFFICULTY_STYLES = {
  easy: 'bg-green-bg text-green-text',
  medium: 'bg-amber-bg text-amber-text',
  hard: 'bg-red-bg text-red-text',
};

function formatTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Waveform({ volumeData }) {
  const recent = volumeData.slice(-BARS);
  const bars = Array.from({ length: BARS }, (_, i) => {
    const entry = recent[i];
    const rms = entry ? entry[1] : 0;
    const height = Math.max(4, Math.min(100, rms * 350));
    return { height, active: rms > 0.25 };
  });

  return (
    <div className="flex items-center justify-center gap-[4px] h-[56px]">
      {bars.map((bar, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-75 ${
            bar.active ? 'bg-text-primary' : 'bg-text-muted'
          }`}
          style={{ height: `${bar.height}%` }}
        />
      ))}
    </div>
  );
}

function CountdownRing({ countdown }) {
  const offset = CIRCUMFERENCE * (1 - countdown / 5);
  return (
    <div className="flex flex-col items-center gap-[12px]">
      <div className="relative w-[100px] h-[100px]">
        <svg
          width="100"
          height="100"
          className="absolute inset-0"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#e2e2de" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#1a1a18"
            strokeWidth="4"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.15s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-heading-1 text-text-primary">{countdown}</span>
        </div>
      </div>
      <span className="text-caption text-text-muted">Think before you speak</span>
    </div>
  );
}

export default function RoundScreen({ sessionRoundCount }) {
  const { state } = useLocation();
  const navigate = useNavigate();

  const word = state?.word;
  const category = state?.category || 'random';
  const challengeMode = state?.challengeMode || false;
  const roundNumber = state?.roundNumber || sessionRoundCount || 1;
  const isWeeklyChallenge = state?.isWeeklyChallenge || false;

  const [phase, setPhase] = useState(challengeMode ? 'challenge' : 'thinking');
  const [countdown, setCountdown] = useState(5);
  const [elapsed, setElapsed] = useState(0);
  const [context, setContext] = useState(null);

  const { startRecording, stopRecording, audioBlob, volumeData, error } = useAudioRecorder();
  const countdownRef = useRef(null);
  const elapsedRef = useRef(null);
  const contextRef = useRef(null);

  // Redirect if navigated to without a word
  useEffect(() => {
    if (!word) navigate('/', { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch context on mount
  useEffect(() => {
    if (!word) return;
    generateContext(word.word, category)
      .then(data => {
        setContext(data.context);
        contextRef.current = data.context;
      })
      .catch(() => {
        const fallback = `Use the word "${word.word}" naturally in a response about a recent challenge you've faced.`;
        setContext(fallback);
        contextRef.current = fallback;
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Thinking countdown — fires only in thinking phase
  useEffect(() => {
    if (phase !== 'thinking') return;
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          beginRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recording elapsed timer — fires only in recording phase
  useEffect(() => {
    if (phase !== 'recording') return;
    elapsedRef.current = setInterval(() => {
      setElapsed(e => {
        if (e >= 59) {
          clearInterval(elapsedRef.current);
          handleDone();
          return 60;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(elapsedRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate when blob is ready
  useEffect(() => {
    if (!audioBlob) return;
    storeAudio(audioBlob, volumeData);
    navigate('/loading', {
      state: { word, context: contextRef.current },
    });
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  function beginRecording() {
    setPhase('recording');
    startRecording();
  }

  function handleDone() {
    clearInterval(elapsedRef.current);
    stopRecording();
  }

  if (!word) return null;

  const difficultyLabel = word.difficulty
    ? word.difficulty.charAt(0).toUpperCase() + word.difficulty.slice(1)
    : '';

  return (
    <AppLayout>
      <div className="pt-[24px] md:pt-[40px] max-w-[640px]">

        {/* Round meta */}
        <div className="flex items-center gap-[8px] mb-[24px]">
          <span className="text-label text-text-muted">Round {roundNumber}</span>
          {isWeeklyChallenge && (
            <span className="flex items-center gap-[4px] text-label bg-amber-bg text-amber-text px-[8px] py-[2px] rounded-full">
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>bolt</span>
              Weekly
            </span>
          )}
        </div>

        {/* Challenge phase: hide word, show record prompt */}
        {phase === 'challenge' && (
          <div className="flex flex-col items-start gap-[32px]">
            <div>
              <div className="text-heading-1 text-text-primary">Ready?</div>
              <div className="text-body text-text-secondary mt-[8px]">
                Your word will appear the moment you start recording.
              </div>
            </div>
            <button
              onClick={beginRecording}
              className="flex items-center gap-[12px] h-[52px] px-[24px] bg-btn-primary-bg text-btn-primary-text text-body-medium rounded-md"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>mic</span>
              Start recording
            </button>
          </div>
        )}

        {/* Thinking + Recording phases */}
        {(phase === 'thinking' || phase === 'recording') && (
          <>
            {/* Word + difficulty tag */}
            <div className="flex items-start gap-[12px] mb-[24px] flex-wrap">
              <h2 className="text-heading-1 text-text-primary">{word.word.toUpperCase()}</h2>
              {word.difficulty && (
                <span
                  className={`text-label px-[10px] py-[4px] rounded-full mt-[6px] ${DIFFICULTY_STYLES[word.difficulty]}`}
                >
                  {difficultyLabel}
                </span>
              )}
            </div>

            {/* Context card */}
            <div className="bg-surface border border-border rounded-lg p-[20px] shadow-sm mb-[32px]">
              {context ? (
                <p className="text-body text-text-primary">{context}</p>
              ) : (
                <div className="space-y-[8px]">
                  <div className="h-[16px] bg-surface-raised rounded-sm animate-pulse w-full" />
                  <div className="h-[16px] bg-surface-raised rounded-sm animate-pulse w-[85%]" />
                  <div className="h-[16px] bg-surface-raised rounded-sm animate-pulse w-[70%]" />
                </div>
              )}
            </div>

            {/* Thinking: countdown ring */}
            {phase === 'thinking' && <CountdownRing countdown={countdown} />}

            {/* Recording: waveform + controls */}
            {phase === 'recording' && (
              <div className="flex flex-col gap-[24px]">
                <Waveform volumeData={volumeData} />

                {error && (
                  <p className="text-caption text-red-text text-center">{error}</p>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-label text-text-muted font-mono tabular-nums">
                    {formatTime(elapsed)} / 1:00
                  </span>
                  <button
                    onClick={handleDone}
                    className="h-[52px] px-[32px] bg-btn-primary-bg text-btn-primary-text text-body-medium rounded-md"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
