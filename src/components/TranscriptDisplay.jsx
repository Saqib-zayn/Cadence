// Highlight priority (highest wins when multiple apply to same word):
//   hard filler          → red-mark bg + red-text
//   confirmed soft filler (LLM-verified) → amber-bg + amber-text
//   possible soft filler (deterministic pre-flag) → amber underline only, no bg
//   bad pause (word after) → amber underline (decoration-amber-mark)
//   good pause (word after) → green-mark bg tint
//   legitimate use         → no highlight

export default function TranscriptDisplay({
  words,
  // filler props (new two-layer system)
  hardFillerIndices,
  softFillerIndices,
  confirmedSoftFillerIndices,
  // pause props
  badPauseIndices,
  goodPauseIndices,
  // plain-text fallback
  plainText,
  llmFillerPositions,
}) {
  // Word-level mode (Whisper timestamp data available)
  if (words?.length) {
    const hasPauses = badPauseIndices?.size > 0 || goodPauseIndices?.size > 0
    const hasSoftFlags = softFillerIndices?.size > 0 || confirmedSoftFillerIndices?.size > 0

    return (
      <div>
        <p className="text-body text-text-primary leading-relaxed">
          {words.map((w, i) => {
            const text   = w.word.trim()
            const spaced = i < words.length - 1 ? text + ' ' : text

            // Priority 1 — hard filler: red-mark bg + red-text
            if (hardFillerIndices?.has(i)) {
              return (
                <span key={i} className="bg-red-mark text-red-text rounded-sm px-[2px]">
                  {spaced}
                </span>
              )
            }

            // Priority 2 — confirmed soft filler (LLM-verified): amber-bg + amber-text
            if (confirmedSoftFillerIndices?.has(i)) {
              return (
                <span key={i} className="bg-amber-bg text-amber-text rounded-sm px-[2px]">
                  {spaced}
                </span>
              )
            }

            // Priority 3 — possible soft filler (deterministic pre-flag): amber underline only
            if (softFillerIndices?.has(i)) {
              return (
                <span
                  key={i}
                  className="underline decoration-[2px] decoration-amber-mark underline-offset-[3px]"
                >
                  {spaced}
                </span>
              )
            }

            // Priority 4 — bad pause follows this word: amber underline (heavier, same style as original)
            if (badPauseIndices?.has(i)) {
              return (
                <span
                  key={i}
                  className="underline decoration-[3px] decoration-amber-mark underline-offset-[2px]"
                >
                  {spaced}
                </span>
              )
            }

            // Priority 5 — good pause follows this word: green-mark bg tint
            if (goodPauseIndices?.has(i)) {
              return (
                <span key={i} className="bg-green-mark rounded-sm px-[2px]">
                  {spaced}
                </span>
              )
            }

            return <span key={i}>{spaced}</span>
          })}
        </p>

        <Legend hasPauses={hasPauses} hasSoftFlags={hasSoftFlags} />
      </div>
    )
  }

  // Plain-text fallback with LLM filler positions (no word-level timestamps)
  if (plainText) {
    const tokens    = plainText.trim().split(/\s+/)
    const fillerSet = new Set(Array.isArray(llmFillerPositions) ? llmFillerPositions : [])

    return (
      <div>
        <p className="text-body text-text-primary leading-relaxed">
          {tokens.map((token, i) => {
            const spaced = i < tokens.length - 1 ? token + ' ' : token
            if (fillerSet.has(i)) {
              return (
                <span key={i} className="bg-red-mark text-red-text rounded-sm px-[2px]">
                  {spaced}
                </span>
              )
            }
            return <span key={i}>{spaced}</span>
          })}
        </p>
        {fillerSet.size > 0 && <Legend hasPauses={false} hasSoftFlags={false} />}
      </div>
    )
  }

  return null
}

function Legend({ hasPauses, hasSoftFlags }) {
  return (
    <div className="mt-[24px] pt-[16px] border-t border-border flex flex-wrap gap-[16px]">
      <div className="flex items-center gap-[6px]">
        <div className="w-[8px] h-[8px] rounded-sm bg-red-mark flex-shrink-0" />
        <span className="text-caption text-text-muted">Filler word</span>
      </div>
      {hasSoftFlags && (
        <div className="flex items-center gap-[6px]">
          <div className="w-[10px] h-[2px] bg-amber-mark flex-shrink-0" />
          <span className="text-caption text-text-muted">Possible filler</span>
        </div>
      )}
      {hasPauses && (
        <>
          <div className="flex items-center gap-[6px]">
            <div className="w-[10px] h-[2px] bg-amber-mark flex-shrink-0" />
            <span className="text-caption text-text-muted">Mid-sentence pause</span>
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[8px] h-[8px] rounded-sm bg-green-mark flex-shrink-0" />
            <span className="text-caption text-text-muted">End-sentence pause</span>
          </div>
        </>
      )}
    </div>
  )
}
