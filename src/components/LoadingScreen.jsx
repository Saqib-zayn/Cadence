import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendAudio } from '../utils/api';
import { getAudio, clearAudio } from '../utils/audioStore';

const PHRASES = [
  "Counting your ums...",
  "Checking your rhythm...",
  "Reading your structure...",
  "Measuring your cadence...",
  "Analysing your pacing...",
  "Sorting fillers from real words...",
  "Looking for authority...",
  "Finding your strongest line...",
  "Almost there...",
];

const STAGES = [
  "Uploading audio",
  "Transcribing speech",
  "Reading structure",
  "Scoring delivery",
];

export default function LoadingScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * PHRASES.length));
  const [stageIdx, setStageIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const barRef = useRef(null);
  const startTimeRef = useRef(null);
  const doneRef = useRef(false);

  // Phrase rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx(i => (i + 1) % PHRASES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Stage label advancement — visual only, advances every ~2s, stops at last stage
  useEffect(() => {
    const interval = setInterval(() => {
      setStageIdx(i => Math.min(i + 1, STAGES.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Progress bar + API call
  useEffect(() => {
    const { blob, volumeData } = getAudio();
    if (!blob) {
      navigate('/', { replace: true });
      return;
    }

    startTimeRef.current = Date.now();

    // Start bar to 90% over 4 seconds
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (barRef.current) {
          barRef.current.style.transition = 'width 4s linear';
          barRef.current.style.width = '90%';
        }
      });
    });

    function finish(transcript) {
      if (doneRef.current) return;
      doneRef.current = true;
      clearAudio();
      const elapsed = Date.now() - startTimeRef.current;
      const holdFor = Math.max(0, 2500 - elapsed);

      setTimeout(() => {
        if (barRef.current) {
          barRef.current.style.transition = 'width 0.4s ease';
          barRef.current.style.width = '100%';
        }
        setTimeout(() => {
          navigate('/results', {
            state: { ...state, volumeData, transcript },
          });
        }, 450);
      }, holdFor);
    }

    sendAudio(blob)
      .then(transcript => finish(transcript))
      .catch(err => {
        if (doneRef.current) return;
        doneRef.current = true;
        clearAudio();
        setErrorMsg(err.message || 'Something went wrong. Please try again.');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorMsg) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-[24px]">
        <div className="bg-surface border border-border rounded-lg p-[20px] shadow-sm max-w-[360px] w-full text-center">
          <p className="text-body text-text-primary mb-[20px]">{errorMsg}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full h-[52px] bg-btn-primary-bg text-btn-primary-text text-body-medium rounded-md"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-[24px]">
      <style>{`
        @keyframes equaliser {
          0%, 100% { height: 8px; }
          50%       { height: 40px; }
        }
      `}</style>

      {/* CSS audio equaliser */}
      <div className="flex items-end gap-[6px] mb-[48px]" style={{ height: '40px' }}>
        {[0, 0.15, 0.3].map((delay, i) => (
          <div
            key={i}
            style={{
              width: '6px',
              height: '8px',
              borderRadius: '9999px',
              backgroundColor: '#D49A2A',
              animation: `equaliser 0.8s ease-in-out infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      {/* Rotating phrase */}
      <p className="text-body-medium text-text-secondary text-center min-h-[24px] mb-[12px]">
        {PHRASES[phraseIdx]}
      </p>

      {/* Stage label */}
      <p className="text-caption text-text-muted text-center mb-[36px]">
        {STAGES[stageIdx]}
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-[320px] h-[4px] bg-surface-raised rounded-full overflow-hidden">
        <div
          ref={barRef}
          className="h-full bg-text-primary rounded-full"
          style={{ width: '0%' }}
        />
      </div>
    </div>
  );
}
