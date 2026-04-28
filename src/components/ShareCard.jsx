import { forwardRef } from 'react';

// Inline styles throughout — html2canvas reads computed styles and Tailwind can be unreliable
// at offscreen render time, so we write everything explicitly.

const TIER = {
  green: { accent: '#3a6b3a', accentBg: '#e8f0e8', accentLight: '#c8dfc8', bar: '#3a6b3a' },
  amber: { accent: '#7a5c1e', accentBg: '#f0ebe0', accentLight: '#e8d5a8', bar: '#7a5c1e' },
  red:   { accent: '#8b3a3a', accentBg: '#f0e8e8', accentLight: '#f0c8c8', bar: '#8b3a3a' },
};

function getTier(score) {
  if (score >= 75) return TIER.green;
  if (score >= 50) return TIER.amber;
  return TIER.red;
}

// Pre-render the score bar as a series of segments
function ScoreBar({ score, accent, accentLight }) {
  const filled = Math.round(score / 10);
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 12,
            borderRadius: 6,
            background: i < filled ? accent : accentLight,
          }}
        />
      ))}
    </div>
  );
}

const ShareCard = forwardRef(function ShareCard({ roundData }, ref) {
  if (!roundData) return null;

  const { word = '', score = 0, feedbackPoints = [], fillerCount = 0 } = roundData;
  const tier = getTier(score);
  const PAD = 72;

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: '#f8f8f6',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: PAD,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Subtle accent tint in top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 320,
          height: 320,
          borderRadius: '0 0 0 320px',
          background: tier.accentBg,
          opacity: 0.5,
        }}
      />

      {/* App mark */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: tier.accent,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          marginBottom: 64,
          position: 'relative',
        }}
      >
        Cadence
      </div>

      {/* Word */}
      <div style={{ marginBottom: 48, position: 'relative' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 400,
            color: '#a0a09a',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Word
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            color: tier.accent,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          {word}
        </div>
      </div>

      {/* Score */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <span
            style={{
              fontSize: 112,
              fontWeight: 700,
              color: tier.accent,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {score}
          </span>
          <span style={{ fontSize: 40, fontWeight: 400, color: '#a0a09a', lineHeight: 1 }}>
            / 100
          </span>
        </div>
        <ScoreBar score={score} accent={tier.accent} accentLight={tier.accentLight} />
      </div>

      {/* Feedback points */}
      {feedbackPoints.length > 0 && (
        <div style={{ marginTop: 56, position: 'relative', flex: 1 }}>
          {feedbackPoints.slice(0, 3).map((point, i) => {
            const positive = typeof point === 'object' ? point.positive : true;
            const text = typeof point === 'object' ? point.text : point;
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 500,
                    color: positive ? tier.accent : '#a0a09a',
                    lineHeight: 1.5,
                    flexShrink: 0,
                  }}
                >
                  {positive ? '✓' : '✗'}
                </span>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 400,
                    color: '#6b6b66',
                    lineHeight: 1.5,
                  }}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filler count fallback if no feedback */}
      {feedbackPoints.length === 0 && fillerCount !== undefined && (
        <div style={{ marginTop: 56, position: 'relative', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ fontSize: 24, fontWeight: 500, color: tier.accent, lineHeight: 1.5 }}>
              {fillerCount <= 1 ? '✓' : '✗'}
            </span>
            <span style={{ fontSize: 26, fontWeight: 400, color: '#6b6b66', lineHeight: 1.5 }}>
              {fillerCount === 0
                ? 'No filler words'
                : fillerCount === 1
                  ? 'Only 1 filler word'
                  : `${fillerCount} filler words`}
            </span>
          </div>
        </div>
      )}

      {/* URL footer */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 40,
          borderTop: `1px solid #e2e2de`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 400, color: '#a0a09a' }}>
          cadence.vercel.app
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: tier.accent,
            background: tier.accentBg,
            padding: '6px 16px',
            borderRadius: 999,
          }}
        >
          Try it free
        </span>
      </div>
    </div>
  );
});

export default ShareCard;
