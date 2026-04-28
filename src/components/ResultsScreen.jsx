import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import TranscriptDisplay from './TranscriptDisplay';
import scoreDeterministic from '../utils/scoring';
import { analyseRound } from '../utils/api';

const DIFFICULTY_STYLES = {
  easy: 'bg-green-bg text-green-text',
  medium: 'bg-amber-bg text-amber-text',
  hard: 'bg-red-bg text-red-text',
};

function scoreColor(n) {
  if (n >= 75) return 'text-green-text';
  if (n >= 50) return 'text-amber-text';
  return 'text-red-text';
}

function deterministicFeedback(scores) {
  const points = [];
  if (scores.fillerWordScore < 20) {
    points.push({ text: 'Reduce filler words — aim for fewer ums and uhs', positive: false });
  }
  if (scores.pauseQualityScore < 14) {
    points.push({ text: 'Work on your pacing — avoid long mid-sentence pauses', positive: false });
  }
  if (points.length === 0) {
    points.push({ text: 'Good delivery — clean pacing and minimal filler words', positive: true });
  }
  return points;
}

function ScoreBreakdownBar({ scores, naturalWordScore, clarityScore, llmLoading }) {
  const segments = [
    { label: 'Fluency',    score: scores.fillerWordScore,      max: 30, trackClass: 'bg-red-bg' },
    { label: 'Pacing',     score: scores.pauseQualityScore,    max: 20, trackClass: 'bg-amber-bg' },
    { label: 'Completion', score: scores.sentenceCompletionScore, max: 10, trackClass: 'bg-surface-raised' },
    { label: 'Word Use',   score: naturalWordScore,             max: 20, trackClass: 'bg-surface-raised', loading: llmLoading },
    { label: 'Clarity',    score: clarityScore,                 max: 20, trackClass: 'bg-surface-raised', loading: llmLoading },
  ];

  function fillClass(score, max, loading) {
    if (loading) return 'bg-border animate-pulse';
    const pct = score / max;
    if (pct >= 0.75) return 'bg-green-mark';
    if (pct >= 0.5) return 'bg-amber-mark';
    return 'bg-red-mark';
  }

  function labelColor(score, max, loading) {
    if (loading) return 'text-text-muted';
    const pct = score / max;
    if (pct >= 0.75) return 'text-green-text';
    if (pct >= 0.5) return 'text-amber-text';
    return 'text-red-text';
  }

  return (
    <div>
      <div className="flex h-[8px] rounded-full overflow-hidden mb-[10px]">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`relative ${seg.trackClass}`}
            style={{ flex: `${seg.max} 0 0` }}
          >
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-700 ${fillClass(seg.score, seg.max, seg.loading)}`}
              style={{ width: seg.loading ? '100%' : `${(seg.score / seg.max) * 100}%` }}
            />
          </div>
        ))}
      </div>

      <div className="flex">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{ flex: `${seg.max} 0 0` }}
          >
            <span className="text-caption text-text-muted truncate w-full text-center px-[2px]">
              {seg.label}
            </span>
            <span className={`text-caption ${labelColor(seg.score, seg.max, seg.loading)}`}>
              {seg.loading ? '–' : `${seg.score}/${seg.max}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResultsScreen({ onGoAgain }) {
  const { state } = useLocation();
  const navigate = useNavigate();

  const word       = state?.word;
  const transcript = state?.transcript;
  const volumeData = state?.volumeData || [];
  const context    = state?.context || '';

  const [llmStatus, setLlmStatus]   = useState('loading');
  const [llmData, setLlmData]       = useState(null);
  const [jsonOpen, setJsonOpen]     = useState(false);

  // Run deterministic scoring synchronously on mount — frontend layer per spec
  const det = useMemo(() => {
    const words = transcript?.words || [];
    const scores = scoreDeterministic(words, volumeData);
    const deterministicTotal =
      scores.fillerWordScore + scores.pauseQualityScore + scores.sentenceCompletionScore;

    const badPauseIndices  = new Set();
    const goodPauseIndices = new Set();
    scores.pauseAnnotations.forEach(({ timestamp, type }) => {
      const idx = words.findIndex(w => Number(w.start) > timestamp / 1000);
      if (idx !== -1) {
        if (type === 'bad')  badPauseIndices.add(idx);
        if (type === 'good') goodPauseIndices.add(idx);
      }
    });

    return { scores, deterministicTotal, badPauseIndices, goodPauseIndices };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Call /api/analyse once on mount
  useEffect(() => {
    if (!transcript || !word) return;
    analyseRound({
      transcript: transcript.text || '',
      word: word.word,
      context,
      pauseData: det.scores.pauseAnnotations,
    })
      .then(data => {
        setLlmData(data);
        setLlmStatus('done');
      })
      .catch(() => setLlmStatus('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist personal best after LLM scores arrive
  useEffect(() => {
    if (llmStatus !== 'done' || !llmData) return;
    const finalScore = det.deterministicTotal + llmData.naturalWordScore + llmData.clarityScore;
    const prev = parseInt(localStorage.getItem('cadence_best_score') || '0', 10);
    if (finalScore > prev) {
      localStorage.setItem('cadence_best_score', String(finalScore));
    }
  }, [llmStatus, llmData, det.deterministicTotal]);

  if (!word || !transcript) {
    return (
      <AppLayout title="Results">
        <div className="pt-[32px] text-body text-text-secondary">
          No results yet.{' '}
          <button onClick={() => navigate('/')} className="text-text-primary underline">
            Go home
          </button>
        </div>
      </AppLayout>
    );
  }

  const llmLoading        = llmStatus === 'loading';
  const naturalWordScore  = llmData?.naturalWordScore ?? 20;
  const clarityScore      = llmData?.clarityScore ?? 20;
  const totalScore        = det.deterministicTotal + naturalWordScore + clarityScore;

  // Read personal best before the save effect fires — correct for delta display
  const personalBest      = parseInt(localStorage.getItem('cadence_best_score') || '0', 10);
  const isNewBest         = llmStatus === 'done' && totalScore > personalBest;
  const delta             = totalScore - personalBest;
  const showBeatNudge     = llmStatus === 'done' && personalBest > 0 && totalScore < personalBest;

  // Filler indices from deterministic layer; LLM positions used only in plain-text fallback
  const fillerIndices = new Set();
  det.scores.fillerWordsFound.forEach(({ word: fw, position }) => {
    const tokenCount = fw.split(/\s+/).length;
    for (let i = 0; i < tokenCount; i++) fillerIndices.add(position + i);
  });

  const feedbackPoints =
    llmStatus === 'done' && llmData?.feedbackPoints?.length
      ? llmData.feedbackPoints
      : deterministicFeedback(det.scores);

  const transcriptWords = transcript.words || [];
  const transcriptText  = transcript.text || transcript.error || '';
  const wordCount       = transcriptWords.length || transcriptText.split(/\s+/).filter(Boolean).length;
  const durationSec     = transcript.duration ? Math.round(transcript.duration) : null;

  const difficultyLabel = word.difficulty
    ? word.difficulty.charAt(0).toUpperCase() + word.difficulty.slice(1)
    : '';

  function handleGoAgain() {
    if (onGoAgain) {
      const diff = localStorage.getItem('cadence_difficulty') || 'easy';
      const cat  = localStorage.getItem('cadence_category') || 'random';
      onGoAgain(diff, cat, false);
    } else {
      navigate('/');
    }
  }

  function handleShare() {
    alert('Sharing coming soon');
  }

  return (
    <AppLayout title="Results" rightIcon="share" onRightIconClick={handleShare}>
      <div className="pt-[24px] md:pt-[40px]">
        <div className="xl:flex xl:gap-[40px]">

          {/* ── Left column: score + breakdown ── */}
          <div className="xl:w-[45%] mb-[32px] xl:mb-0">

            {/* Round pill */}
            <div className="flex items-center gap-[8px] mb-[16px]">
              {state?.roundNumber && (
                <span className="text-label bg-surface-raised text-text-primary px-[10px] py-[4px] rounded-full">
                  Round {state.roundNumber}
                </span>
              )}
            </div>

            {/* Word + difficulty badge */}
            <div className="flex items-start gap-[12px] mb-[8px] flex-wrap">
              <h1 className="text-heading-1 text-text-primary uppercase tracking-tight">
                {word.word.toUpperCase()}
              </h1>
              {word.difficulty && (
                <span
                  className={`text-label px-[10px] py-[4px] rounded-full mt-[6px] ${DIFFICULTY_STYLES[word.difficulty]}`}
                >
                  {difficultyLabel}
                </span>
              )}
            </div>

            {/* Word count + duration metadata */}
            <div className="flex items-center gap-[16px] mb-[24px]">
              <span className="text-caption text-text-muted">{wordCount} words</span>
              {durationSec !== null && (
                <span className="text-caption text-text-muted">{durationSec}s</span>
              )}
            </div>

            {/* Score number */}
            <div className="flex items-baseline gap-[8px] mb-[4px]">
              <span className={`text-display transition-colors duration-500 ${scoreColor(totalScore)}`}>
                {totalScore}
              </span>
              <span className="text-heading-2 text-text-muted">/100</span>
            </div>

            {/* Delta / loading / new best */}
            <div className="text-caption text-text-muted mb-[24px] min-h-[20px]">
              {llmLoading && 'Analysing word usage and clarity…'}
              {llmStatus === 'error' && 'Analysis unavailable — deterministic score only'}
              {llmStatus === 'done' && isNewBest && (
                <span className="text-green-text">📈 New personal best!</span>
              )}
              {llmStatus === 'done' && !isNewBest && personalBest > 0 && delta !== 0 && (
                <span>{delta > 0 ? `+${delta}` : delta} from your best</span>
              )}
            </div>

            {/* Score breakdown bar */}
            <ScoreBreakdownBar
              scores={det.scores}
              naturalWordScore={naturalWordScore}
              clarityScore={clarityScore}
              llmLoading={llmLoading}
            />
          </div>

          {/* ── Right column: transcript + feedback + actions ── */}
          <div className="xl:w-[55%]">

            {/* Transcript card */}
            <div className="bg-surface border border-border rounded-lg p-[20px] shadow-sm mb-[24px]">
              <div className="text-body-medium text-text-primary mb-[16px]">Transcript Analysis</div>
              {transcript.error ? (
                <p className="text-body text-red-text">{transcript.error}</p>
              ) : transcriptWords.length > 0 ? (
                <TranscriptDisplay
                  words={transcriptWords}
                  fillerIndices={fillerIndices}
                  badPauseIndices={det.badPauseIndices}
                  goodPauseIndices={det.goodPauseIndices}
                />
              ) : transcriptText ? (
                <TranscriptDisplay
                  plainText={transcriptText}
                  llmFillerPositions={llmData?.fillerWordPositions}
                />
              ) : null}
            </div>

            {/* Feedback cards */}
            <div className="flex flex-col gap-[16px] mb-[32px]">
              {llmLoading ? (
                <>
                  <div className="pl-[16px] border-l-[3px] border-border py-[4px]">
                    <div className="h-[16px] bg-surface-raised rounded-sm animate-pulse w-[60%] mb-[8px]" />
                    <div className="h-[14px] bg-surface-raised rounded-sm animate-pulse w-[85%]" />
                  </div>
                  <div className="pl-[16px] border-l-[3px] border-border py-[4px]">
                    <div className="h-[16px] bg-surface-raised rounded-sm animate-pulse w-[50%] mb-[8px]" />
                    <div className="h-[14px] bg-surface-raised rounded-sm animate-pulse w-[75%]" />
                  </div>
                </>
              ) : (
                feedbackPoints.map((point, i) => (
                  <div
                    key={i}
                    className={`pl-[16px] border-l-[3px] py-[4px] ${
                      point.positive ? 'border-green-text' : 'border-amber-text'
                    }`}
                  >
                    <p className="text-body text-text-primary">{point.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Beat This Score nudge */}
            {showBeatNudge && (
              <div className="bg-amber-bg border border-border rounded-lg p-[16px] mb-[24px]">
                <p className="text-body-medium text-text-primary mb-[8px]">
                  Your best is {personalBest}. One more round?
                </p>
                <button
                  onClick={handleGoAgain}
                  className="text-body-medium text-amber-text flex items-center gap-[4px]"
                >
                  Beat it
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    arrow_forward
                  </span>
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-[12px] xl:w-[280px] mb-[24px]">
              <button
                onClick={handleGoAgain}
                className="w-full h-[52px] md:h-[56px] xl:h-[52px] bg-btn-primary-bg text-btn-primary-text text-body-medium rounded-md flex items-center justify-center gap-[8px] active:opacity-90 transition-opacity"
              >
                Go again
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  arrow_forward
                </span>
              </button>
              <button
                onClick={handleShare}
                className="w-full h-[52px] md:h-[56px] xl:h-[52px] bg-btn-secondary-bg text-btn-secondary-text text-body-medium rounded-md flex items-center justify-center active:opacity-90 transition-opacity"
              >
                Share score
              </button>
            </div>

            {/* Raw data collapsible — dev aid */}
            <div className="mb-[24px]">
              <button
                onClick={() => setJsonOpen(o => !o)}
                className="flex items-center gap-[6px] text-caption text-text-muted"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  {jsonOpen ? 'expand_less' : 'expand_more'}
                </span>
                {jsonOpen ? 'Hide' : 'Show'} raw data
              </button>
              {jsonOpen && (
                <pre className="mt-[12px] p-[16px] bg-surface border border-border rounded-lg text-caption text-text-secondary overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
                  {JSON.stringify(
                    { transcript, deterministicScores: det.scores, llmData },
                    null,
                    2,
                  )}
                </pre>
              )}
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
