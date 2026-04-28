import { HARD_FILLERS, SOFT_FILLERS } from "./fillerWords.js"

const MAX_FILLER_SCORE   = 20
const MAX_PACING_SCORE   = 15
const MAX_SENTENCE_SCORE = 10

const INCOMPLETE_CLAUSE_ENDINGS = new Set([
  "a", "an", "and", "as", "because", "but", "for", "if", "in", "of", "or",
  "so", "than", "that", "the", "then", "to", "when", "where", "which", "while", "with",
])

// ─── helpers ────────────────────────────────────────────────────────────────

const normalizeWord = (word = "") =>
  String(word).trim().toLowerCase().replace(/[^\w']/g, "")

const normalizePhrase = (phrase = "") =>
  String(phrase).trim().toLowerCase().replace(/[^\w'\s]/g, "").replace(/\s+/g, " ")

const hasTerminalPunctuation = (word = "") => /[.!?]$/.test(String(word).trim())

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const getDuration = (entry = {}) => {
  const start = Number(entry.start)
  const end = Number(entry.end)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}

// Average RMS volume between two timestamps (seconds)
const getAverageVolumeBetween = (volumeData, startSec, endSec) => {
  if (!Array.isArray(volumeData) || volumeData.length === 0) return null

  const matching = volumeData
    .filter(([ms]) => {
      const s = Number(ms) / 1000
      return s >= startSec && s <= endSec
    })
    .map(([, rms]) => Number(rms))
    .filter(Number.isFinite)

  if (matching.length === 0) return null
  return matching.reduce((sum, v) => sum + v, 0) / matching.length
}

// ─── FIX 1: two-layer filler detection ──────────────────────────────────────

// Hard fillers: always counted, deducted from fillerWordScore.
// All are single tokens so simple set lookup is sufficient.
export const findHardFillers = (transcript = []) => {
  const hardSet = new Set(HARD_FILLERS.map(normalizePhrase))
  const matches = []

  transcript.forEach((entry, i) => {
    if (hardSet.has(normalizeWord(entry?.word))) {
      matches.push({ word: normalizeWord(entry.word), position: i })
    }
  })

  return matches
}

// Soft fillers: flagged only when a qualifying condition is met.
// transcript entries are { word, start, end } from Whisper.
export const findSoftFillerFlags = (transcript = []) => {
  // Build normalised phrase list, longest first so multi-token phrases match before subsets
  const softList = SOFT_FILLERS.map(f => ({
    word: f,
    tokens: normalizePhrase(f).split(" "),
  })).sort((a, b) => b.tokens.length - a.tokens.length)

  const hardSet = new Set(HARD_FILLERS.map(normalizePhrase))
  const normalizedWords = transcript.map(e => normalizeWord(e?.word))

  // First pass: collect all occurrences and their positions
  const occurrences = []
  let idx = 0
  while (idx < normalizedWords.length) {
    const match = softList.find(f =>
      f.tokens.every((token, offset) => normalizedWords[idx + offset] === token)
    )
    if (match) {
      occurrences.push({ word: match.word, position: idx, tokenCount: match.tokens.length })
      idx += match.tokens.length
    } else {
      idx++
    }
  }

  // Count occurrences per phrase for the repetition check
  const counts = {}
  occurrences.forEach(({ word }) => { counts[word] = (counts[word] || 0) + 1 })

  // Build a set of positions covered by other occurrences for the combo check
  const occPositionSet = new Set()
  occurrences.forEach(({ position, tokenCount }) => {
    for (let j = 0; j < tokenCount; j++) occPositionSet.add(position + j)
  })

  const flags = []

  for (const occ of occurrences) {
    const { word, position, tokenCount } = occ
    const reasons = []

    // Condition 1: repeated more than twice
    if (counts[word] > 2) reasons.push("repeated")

    // Condition 2: start of sentence — position 0 or previous word ends with terminal punctuation
    const prevWord = transcript[position - 1]
    if (position === 0 || hasTerminalPunctuation(prevWord?.word)) {
      reasons.push("sentence_start")
    }

    // Condition 3: surrounded by pauses > 0.4s on both sides
    const firstToken = transcript[position]
    const lastToken  = transcript[position + tokenCount - 1]
    const nextEntry  = transcript[position + tokenCount]

    if (firstToken && lastToken) {
      const gapBefore = prevWord
        ? Number(firstToken.start) - Number(prevWord.end)
        : null
      const gapAfter = nextEntry
        ? Number(nextEntry.start) - Number(lastToken.end)
        : null

      if (
        gapBefore !== null && Number.isFinite(gapBefore) && gapBefore > 0.4 &&
        gapAfter  !== null && Number.isFinite(gapAfter)  && gapAfter  > 0.4
      ) {
        reasons.push("surrounded_by_pauses")
      }
    }

    // Condition 4: combo pattern — immediately adjacent to a hard filler or another soft filler
    const tokenBefore = normalizedWords[position - 1]
    const tokenAfter  = normalizedWords[position + tokenCount]
    const beforeIsFillerish = tokenBefore && (hardSet.has(tokenBefore) || occPositionSet.has(position - 1))
    const afterIsFillerish  = tokenAfter  && (hardSet.has(tokenAfter)  || occPositionSet.has(position + tokenCount))
    if (beforeIsFillerish || afterIsFillerish) {
      reasons.push("combo_pattern")
    }

    if (reasons.length > 0) {
      flags.push({ word, position, reason: reasons[0] })
    }
  }

  return flags
}

export const scoreFillerWords = (hardFillerCount) =>
  clamp(MAX_FILLER_SCORE - hardFillerCount * 3, 0, MAX_FILLER_SCORE)

export const scorePacing = (wordCount, durationSec) => {
  if (!durationSec || durationSec <= 0 || !wordCount) return 0
  const wpm = (wordCount / durationSec) * 60
  if (wpm >= 110 && wpm <= 160) return MAX_PACING_SCORE
  if ((wpm >= 90 && wpm < 110) || (wpm > 160 && wpm <= 180)) return 10
  return 5
}

// ─── FIX 2: pause detection rewrite ─────────────────────────────────────────
//
// Primary source: Whisper word timestamps (reliable gap data)
// Secondary:      volumeData cross-check to reduce penalty for Whisper alignment glitches
//
// Gap classification (per word pair):
//   < 0.15s              → normal speech flow, skip
//   > 1.5s  mid-sentence → BAD (deduct 3 pts; reduced to 1 if RMS > 0.05 → likely Whisper issue)
//   0.3–1.0s at sentence boundary → GOOD
//   everything else      → neutral (no annotation or penalty)

export const analyzePauses = (transcript = [], volumeData = []) => {
  const annotations = []

  for (let i = 0; i < transcript.length - 1; i++) {
    const current = transcript[i]
    const next    = transcript[i + 1]

    const currentEnd = Number(current?.end)
    const nextStart  = Number(next?.start)

    if (!Number.isFinite(currentEnd) || !Number.isFinite(nextStart)) {
      console.log(
        `Pause check: non-numeric timestamps at index ${i}`,
        { word: current?.word, end: current?.end, nextWord: next?.word, start: next?.start }
      )
      continue
    }

    const gap = nextStart - currentEnd

    // Skip imperceptible gaps
    if (gap < 0.15) continue

    const atBoundary = hasTerminalPunctuation(current?.word)
    let type    = "neutral"
    let penalty = 0

    if (atBoundary) {
      if (gap >= 0.3 && gap <= 1.0) {
        type = "good"
      }
      // gap > 1.0 at sentence boundary → neutral (long but natural resting point)
    } else {
      if (gap > 1.5) {
        type    = "bad"
        penalty = 3

        // Secondary: if volume data shows speech was still present, Whisper may have mis-aligned
        const avgRms = getAverageVolumeBetween(volumeData, currentEnd, nextStart)
        if (avgRms !== null && avgRms > 0.05) {
          penalty = 1
          console.log(
            `Pause: ${gap.toFixed(2)}s after "${current?.word}" → bad (RMS ${avgRms.toFixed(3)} > 0.05, reduced penalty 3→1)`
          )
        } else {
          console.log(`Pause: ${gap.toFixed(2)}s after "${current?.word}" → bad (penalty 3)`)
        }
      } else {
        console.log(`Pause: ${gap.toFixed(2)}s after "${current?.word}" → neutral`)
      }
    }

    if (type !== "neutral" || gap >= 0.3) {
      // Record all non-trivial gaps for display; scoring only uses bad/good
      if (type === "good" || type === "bad") {
        console.log(`Pause: ${gap.toFixed(2)}s after "${current?.word}" → ${type}`)
      }
      annotations.push({
        afterWord: String(current?.word || ""),
        duration:  Math.round(gap * 100) / 100,
        type,
        penalty,                                  // 0 for non-bad, 1–3 for bad
        timestamp: Math.round(currentEnd * 1000), // ms — used by ResultsScreen index lookup
      })
    }
  }

  return annotations
}

// ─── Sentence completion (unchanged) ─────────────────────────────────────────

export const scoreSentenceCompletion = (transcript = []) => {
  if (!Array.isArray(transcript) || transcript.length === 0) return 0

  const spokenWords = transcript.map(e => normalizeWord(e?.word)).filter(Boolean)
  if (spokenWords.length < 4) return 4

  const lastEntry    = transcript[transcript.length - 1]
  const lastWord     = spokenWords[spokenWords.length - 1]
  const lastDuration = getDuration(lastEntry)

  let score = MAX_SENTENCE_SCORE
  if (!hasTerminalPunctuation(lastEntry?.word)) score -= 2
  if (INCOMPLETE_CLAUSE_ENDINGS.has(lastWord))  score -= 5
  if (lastDuration > 1.2)                        score -= 2

  return clamp(score, 0, MAX_SENTENCE_SCORE)
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const scoreDeterministic = (transcript = [], volumeData = [], durationSec = 0) => {
  console.log('=== SCORING DEBUG ===')
  console.log('Words received:', JSON.stringify(transcript))
  console.log('Hard fillers list:', HARD_FILLERS)
  console.log('First word check:', transcript?.[0]?.word,
    '→ normalised:', normalizeWord(transcript?.[0]?.word))

  const hardFillerMatches  = findHardFillers(transcript)
  const softFillerFlags    = findSoftFillerFlags(transcript)
  const pauseAnnotations   = analyzePauses(transcript, volumeData)

  const hardFillerCount         = hardFillerMatches.length
  console.log('Hard fillers found:', hardFillerCount)
  console.log('Soft filler flags:', softFillerFlags)
  const fillerWordScore         = scoreFillerWords(hardFillerCount)
  const pacingScore             = scorePacing(transcript.length, durationSec)
  const sentenceCompletionScore = scoreSentenceCompletion(transcript)

  return {
    fillerWordScore,
    pacingScore,
    sentenceCompletionScore,
    fillerWordsFound: hardFillerMatches,
    hardFillerCount,
    softFillerFlags,
    pauseAnnotations,
  }
}

export default scoreDeterministic
