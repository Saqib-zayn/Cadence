import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { sendAudio } from '../utils/api';
import { getAudio, clearAudio } from '../utils/audioStore';

const PHRASES = [
  "Counting your ums...",
  "Checking your rhythm...",
  "Was that a pause or a think?",
  "Measuring your cadence...",
  "Analysing your pacing...",
  "How many 'basically's was that?",
  "Almost there...",
  "Finding your filler words...",
  "That pause was interesting...",
  "Reading between the words...",
];

export default function LoadingScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [phraseIdx, setPhraseIdx] = useState(() => Math.floor(Math.random() * PHRASES.length));
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
        finish({ error: err.message || 'Transcription failed', words: [], text: '' });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-[24px]">
      {/* Pulse animation */}
      <div className="relative mb-[48px]">
        <div className="w-[80px] h-[80px] rounded-full bg-surface-raised animate-pulse" />
        <div
          className="absolute inset-0 w-[80px] h-[80px] rounded-full bg-surface-raised opacity-60"
          style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.3s' }}
        />
      </div>

      {/* Rotating phrase */}
      <p className="text-body-medium text-text-secondary text-center min-h-[24px] mb-[48px]">
        {PHRASES[phraseIdx]}
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
