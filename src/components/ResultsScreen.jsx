import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppLayout from './AppLayout';
import TranscriptDisplay from './TranscriptDisplay';
import ShareCard from './ShareCard';
import scoreDeterministic from '../utils/scoring';
import { analyseRound } from '../utils/api';
import { generateShareCard, generateShareText, triggerShare } from '../utils/shareCard';
import { saveRound } from '../hooks/useLocalStorage';
import { useStreak } from '../hooks/useStreak';

const DIFFICULTY_STYLES = {
  easy: 'bg-green-bg text-green-text',
  medium: 'bg-amber-bg text-amber-text',
  hard: 'bg-red-bg text-red-text',
};

function scoreColor(n, maxScore = 100) {
  const pct = n / maxScore;
  if (pct >= 0.75) return 'text-green-text';
  if (pct >= 0.5)  return 'text-amber-text';
  return 'text-red-text';
}

function deterministicFeedback(scores) {
  const points = [];
  if (scores.fillerWordScore < 14) {
    points.push({ type: 'improvement', message: 'Reduce filler words — aim for fewer ums and uhs' });
  }
  if (scores.pacingScore < 10) {
    points.push({ type: 'improvement', message: 'Work on your pacing — aim for 110–160 words per minute' });
  }
  if (points.length === 0) {
    points.push({ type: 'strength', message: 'Good delivery — clean pacing and minimal filler words' });
  }
  return points;
}

function ScoreBreakdownBar({ scores, llmData, llmLoading, llmError }) {
  const clarityWordUse = (llmData?.clarityScore ?? 0) + (llmData?.naturalWordUsageScore ?? 0);
  const structureAuth  = (llmData?.structureScore ?? 0) + (llmData?.authorityScore ?? 0);

  const segments = [
    { label: 'Filler',              score: scores.fillerWordScore,          max: 20, trackClass: 'bg-red-bg' },
    { label: 'Pacing',              score: scores.pacingScore,              max: 15, trackClass: 'bg-amber-bg' },
    { label: 'Completion',          score: scores.sentenceCompletionScore,  max: 10, trackClass: 'bg-surface-raised' },
    { label: 'Clarity',   score: clarityWordUse, max: 35, trackClass: 'bg-surface-raised', loading: llmLoading, failed: llmError },
    { label: 'Structure', score: structureAuth,  max: 20, trackClass: 'bg-surface-raised', loading: llmLoading, failed: llmError },
  ];

  function fillClass(score, max, loading, failed) {
    if (loading) return 'bg-border animate-pulse';
    if (failed)  return 'bg-border';
    const pct = score / max;
    if (pct >= 0.75) return 'bg-green-mark';
    if (pct >= 0.5)  return 'bg-amber-mark';
    return 'bg-red-mark';
  }

  function labelColor(score, max, loading, failed) {
    if (loading || failed) return 'text-text-muted';
    const pct = score / max;
    if (pct >= 0.75) return 'text-green-text';
    if (pct >= 0.5)  return 'text-amber-text';
    return 'text-red-text';
  }

  return (
    <div>
      <div className="flex h-[8px] rounded-full overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`relative ${seg.trackClass}`}
            style={{ flex: `${seg.max} 0 0` }}
          >
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-700 ${fillClass(seg.score, seg.max, seg.loading, seg.failed)}`}
              style={{ width: (seg.loading || seg.failed) ? '100%' : `${(seg.score / seg.max) * 100}%` }}
            />
          </div>
        ))}
      </div>

      <div className="flex mt-[8px]">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{ flex: `${seg.max} 0 0` }}
          >
            <span className="text-[10px] text-text-muted truncate w-full text-center px-[8px]">
              {seg.label}
            </span>
            <span className={`text-[10px] ${labelColor(seg.score, seg.max, seg.loading, seg.failed)}`}>
              {seg.loading ? '–' : seg.failed ? '–' : `${seg.score}/${seg.max}`}
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

  const word            = state?.word;
  const transcript      = state?.transcript;
  const volumeData      = state?.volumeData || [];
  const context         = state?.context || '';
  const contextCategory = state?.category || 'random';

  const [llmStatus, setLlmStatus]   = useState('loading');
  const [llmData, setLlmData]       = useState(null);
  const [jsonOpen, setJsonOpen]     = useState(false);
  const [sharing, setSharing]       = useState(false);
  const shareCardRef                = useRef(null);
  const savedRef                    = useRef(false);

  const { incrementStreak } = useStreak();

  // Run deterministic scoring synchronously on mount — frontend layer per spec
  const det = useMemo(() => {
    const words = transcript?.words || [];
    const scores = scoreDeterministic(words, volumeData, transcript?.duration ?? 0);
    console.log('Scoring input words:', transcript?.words?.map(w => w.word));
    console.log('Scoring result:', JSON.stringify(scores, null, 2));
    const deterministicTotal =
      scores.fillerWordScore + scores.pacingScore + scores.sentenceCompletionScore;

    // Build word-index sets for transcript annotation
    const hardFillerIndices = new Set();
    scores.fillerWordsFound.forEach(({ word: fw, position }) => {
      const tokenCount = fw.split(/\s+/).length;
      for (let i = 0; i < tokenCount; i++) hardFillerIndices.add(position + i);
    });

    const softFillerIndices = new Set();
    scores.softFillerFlags.forEach(({ word: fw, position }) => {
      const tokenCount = fw.split(/\s+/).length;
      for (let i = 0; i < tokenCount; i++) softFillerIndices.add(position + i);
    });

    const badPauseIndices  = new Set();
    const goodPauseIndices = new Set();
    scores.pauseAnnotations.forEach(({ timestamp, type }) => {
      const idx = words.findIndex(w => Number(w.start) > timestamp / 1000);
      if (idx !== -1) {
        if (type === 'bad')  badPauseIndices.add(idx);
        if (type === 'good') goodPauseIndices.add(idx);
      }
    });

    return { scores, deterministicTotal, hardFillerIndices, softFillerIndices, badPauseIndices, goodPauseIndices };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Call /api/analyse once on mount
  useEffect(() => {
    if (!transcript || !word) return;
    analyseRound({
      transcript: transcript.text || '',
      word: word.word,
      context,
      contextCategory,
      transcriptDuration: transcript.duration ?? 0,
      softFillerFlags: det.scores.softFillerFlags,
    })
      .then(data => {
        setLlmData(data);
        setLlmStatus('done');
      })
      .catch(() => setLlmStatus('error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist completed round once LLM resolves (done or error)
  useEffect(() => {
    if ((llmStatus !== 'done' && llmStatus !== 'error') || savedRef.current) return;
    if (!word || !transcript) return;
    savedRef.current = true;
    incrementStreak({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      word: word.word,
      difficulty: word.difficulty,
      contextCategory,
      fillerCount: det.scores.hardFillerCount,
      fillerWordsFound: det.scores.fillerWordsFound,
      pauseCount: det.scores.pauseAnnotations?.filter(p => p.type === 'bad').length || 0,
      fluencyScore: llmData?.totalScore ?? det.deterministicTotal,
      scoreBreakdown: {
        fillerWords: det.scores.fillerWordScore,
        pauseQuality: det.scores.pacingScore,
        sentenceCompletion: det.scores.sentenceCompletionScore,
      },
      transcript: transcript.text,
      feedbackPoints: llmData?.feedbackPoints || [],
      isWeeklyChallenge: state?.isWeeklyChallenge || false,
    });
  }, [llmStatus, llmData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist personal best after LLM scores arrive
  useEffect(() => {
    if (llmStatus !== 'done' || !llmData?.totalScore) return;
    const prev = parseInt(localStorage.getItem('cadence_best_score') || '0', 10);
    if (llmData.totalScore > prev) {
      localStorage.setItem('cadence_best_score', String(llmData.totalScore));
    }
  }, [llmStatus, llmData]);

  if (!word || !transcript) {
    return (
      <AppLayout title="Results" maxWidth="960px">
        <div className="pt-[32px] text-body text-text-secondary">
          No results yet.{' '}
          <button onClick={() => navigate('/')} className="text-text-primary underline">
            Go home
          </button>
        </div>
      </AppLayout>
    );
  }

  const llmLoading = llmStatus === 'loading';
  const llmError   = llmStatus === 'error';
  const displayScore = llmStatus === 'done' && llmData?.totalScore != null
    ? llmData.totalScore
    : det.deterministicTotal;
  const totalScore = displayScore;

  // Read personal best before the save effect fires — correct for delta display
  const personalBest      = parseInt(localStorage.getItem('cadence_best_score') || '0', 10);
  const isNewBest         = llmStatus === 'done' && totalScore > personalBest;
  const delta             = totalScore - personalBest;
  const showBeatNudge     = llmStatus === 'done' && personalBest > 0 && totalScore < personalBest;

  // Confirmed soft filler positions from LLM (amber-bg highlight)
  const confirmedSoftFillerIndices = new Set(llmData?.confirmedSoftFillerPositions || []);

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

  async function handleShare() {
    if (sharing || !shareCardRef.current) return;
    setSharing(true);
    try {
      const blobUrl = await generateShareCard(shareCardRef.current);
      const text = generateShareText(totalScore, word.word);
      await triggerShare(blobUrl, text);
    } finally {
      setSharing(false);
    }
  }

  return (
    <AppLayout title="Results" rightIcon="share" onRightIconClick={handleShare} maxWidth="960px">
      <div className="pt-[24px] md:pt-[40px]">
        <div className="xl:flex xl:gap-[48px]">

          {/* ── Left column: score + breakdown ── */}
          <div className="xl:w-[45%] mb-[32px] xl:mb-0 xl:pb-[24px]">

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
              <span className={`text-display transition-colors duration-500 ${scoreColor(totalScore, llmStatus === 'done' ? 100 : 45)}`}>
                {totalScore}
              </span>
              {llmStatus === 'done' && (
                <span className="text-heading-2 text-text-muted">/100</span>
              )}
              {llmError && (
                <span className="text-heading-2 text-text-muted">/45</span>
              )}
            </div>

            {/* Delta / loading / new best */}
            <div className="text-caption text-text-muted mb-[24px] min-h-[20px]">
              {llmLoading && 'Analysing word usage and clarity…'}
              {llmError && 'Partial score — analysis unavailable'}
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
              llmData={llmData}
              llmLoading={llmLoading}
              llmError={llmError}
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
                  hardFillerIndices={det.hardFillerIndices}
                  softFillerIndices={det.softFillerIndices}
                  confirmedSoftFillerIndices={confirmedSoftFillerIndices}
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
                      point.type === 'strength' ? 'border-green-text' : 'border-amber-text'
                    }`}
                  >
                    <p className="text-body text-text-primary">{point.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* One-line summary + retry focus */}
            {llmStatus === 'done' && (llmData?.oneLineSummary || llmData?.suggestedRetryFocus) && (
              <div className="bg-surface border border-border rounded-lg p-[16px] mb-[24px] flex flex-col gap-[8px]">
                {llmData.oneLineSummary && (
                  <p className="text-body text-text-primary">{llmData.oneLineSummary}</p>
                )}
                {llmData.suggestedRetryFocus && (
                  <p className="text-caption text-text-muted">
                    Next time: {llmData.suggestedRetryFocus}
                  </p>
                )}
              </div>
            )}

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
                disabled={sharing}
                className="w-full h-[52px] md:h-[56px] xl:h-[52px] bg-btn-secondary-bg text-btn-secondary-text text-body-medium rounded-md flex items-center justify-center gap-[6px] active:opacity-90 transition-opacity disabled:opacity-50"
              >
                {sharing ? 'Generating…' : 'Share score'}
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

      {/* Hidden share card — captured by html2canvas on share */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <ShareCard
          ref={shareCardRef}
          roundData={{
            word: word.word,
            score: totalScore,
            feedbackPoints: llmStatus === 'done' ? (llmData?.feedbackPoints || []) : [],
            fillerCount: det.scores.fillerWordsFound.length,
          }}
        />
      </div>
    </AppLayout>
  );
}
