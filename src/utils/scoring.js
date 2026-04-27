import { FILLER_WORDS } from "./fillerWords.js"

const MAX_FILLER_SCORE = 30
const MAX_PAUSE_SCORE = 20
const MAX_SENTENCE_SCORE = 10

const BAD_PAUSE_THRESHOLD_SECONDS = 1.5
const GOOD_PAUSE_MIN_SECONDS = 0.3
const GOOD_PAUSE_MAX_SECONDS = 1
const WORD_GAP_MIN_SECONDS = 0.2
const SILENCE_RMS_THRESHOLD = 0.015

const INCOMPLETE_CLAUSE_ENDINGS = new Set([
  "a",
  "an",
  "and",
  "as",
  "because",
  "but",
  "for",
  "if",
  "in",
  "of",
  "or",
  "so",
  "than",
  "that",
  "the",
  "then",
  "to",
  "when",
  "where",
  "which",
  "while",
  "with"
])

const normalizeWord = (word = "") =>
  String(word)
    .trim()
    .toLowerCase()
    .replace(/[^\w']/g, "")

const normalizePhrase = (phrase = "") =>
  String(phrase)
    .trim()
    .toLowerCase()
    .replace(/[^\w'\s]/g, "")
    .replace(/\s+/g, " ")

const hasTerminalPunctuation = (word = "") => /[.!?]$/.test(String(word).trim())

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const getDuration = (entry = {}) => {
  const start = Number(entry.start)
  const end = Number(entry.end)

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.max(0, end - start)
}

const getAverageVolumeBetween = (volumeData, startSeconds, endSeconds) => {
  if (!Array.isArray(volumeData) || volumeData.length === 0) return null

  const matching = volumeData
    .filter(([timestampMs]) => {
      const timestampSeconds = Number(timestampMs) / 1000
      return timestampSeconds >= startSeconds && timestampSeconds <= endSeconds
    })
    .map(([, volume]) => Number(volume))
    .filter(Number.isFinite)

  if (matching.length === 0) return null

  return matching.reduce((sum, volume) => sum + volume, 0) / matching.length
}

export const findFillerWords = (transcript = []) => {
  const normalizedFillers = FILLER_WORDS.map((word) => ({
    word,
    tokens: normalizePhrase(word).split(" ")
  })).sort((a, b) => b.tokens.length - a.tokens.length)

  const words = transcript.map((entry) => normalizeWord(entry?.word))
  const matches = []
  let index = 0

  while (index < words.length) {
    const match = normalizedFillers.find((filler) =>
      filler.tokens.every((token, offset) => words[index + offset] === token)
    )

    if (match) {
      matches.push({ word: match.word, position: index })
      index += match.tokens.length
    } else {
      index += 1
    }
  }

  return matches
}

export const scoreFillerWords = (fillerCount) =>
  clamp(MAX_FILLER_SCORE - fillerCount * 3, 0, MAX_FILLER_SCORE)

const isSentenceBoundary = (entry) => hasTerminalPunctuation(entry?.word)

export const analyzePauses = (transcript = [], volumeData = []) => {
  const annotations = []

  for (let index = 0; index < transcript.length - 1; index += 1) {
    const current = transcript[index]
    const next = transcript[index + 1]
    const currentEnd = Number(current?.end)
    const nextStart = Number(next?.start)

    if (!Number.isFinite(currentEnd) || !Number.isFinite(nextStart)) continue

    const duration = nextStart - currentEnd
    if (duration < WORD_GAP_MIN_SECONDS) continue

    const averageVolume = getAverageVolumeBetween(volumeData, currentEnd, nextStart)
    const isLikelySilent = averageVolume === null || averageVolume <= SILENCE_RMS_THRESHOLD

    if (!isLikelySilent) continue

    const sentenceBoundary = isSentenceBoundary(current)
    const isGood =
      sentenceBoundary &&
      duration >= GOOD_PAUSE_MIN_SECONDS &&
      duration <= GOOD_PAUSE_MAX_SECONDS

    const isBad = !sentenceBoundary && duration > BAD_PAUSE_THRESHOLD_SECONDS

    if (isGood || isBad) {
      annotations.push({
        timestamp: Math.round(currentEnd * 1000),
        duration: Math.round(duration * 100) / 100,
        type: isGood ? "good" : "bad"
      })
    }
  }

  return annotations
}

export const scorePauseQuality = (pauseAnnotations = []) => {
  const badCount = pauseAnnotations.filter((pause) => pause.type === "bad").length
  const goodCount = pauseAnnotations.filter((pause) => pause.type === "good").length

  return clamp(MAX_PAUSE_SCORE - badCount * 5 + Math.min(goodCount, 4), 0, MAX_PAUSE_SCORE)
}

export const scoreSentenceCompletion = (transcript = []) => {
  if (!Array.isArray(transcript) || transcript.length === 0) return 0

  const spokenWords = transcript.map((entry) => normalizeWord(entry?.word)).filter(Boolean)
  if (spokenWords.length < 4) return 4

  const lastEntry = transcript[transcript.length - 1]
  const lastWord = spokenWords[spokenWords.length - 1]
  const lastWordDuration = getDuration(lastEntry)

  let score = MAX_SENTENCE_SCORE

  if (!hasTerminalPunctuation(lastEntry?.word)) score -= 2
  if (INCOMPLETE_CLAUSE_ENDINGS.has(lastWord)) score -= 5
  if (lastWordDuration > 1.2) score -= 2

  return clamp(score, 0, MAX_SENTENCE_SCORE)
}

export const scoreDeterministic = (transcript = [], volumeData = []) => {
  const fillerWordsFound = findFillerWords(transcript)
  const pauseAnnotations = analyzePauses(transcript, volumeData)

  return {
    fillerWordScore: scoreFillerWords(fillerWordsFound.length),
    pauseQualityScore: scorePauseQuality(pauseAnnotations),
    sentenceCompletionScore: scoreSentenceCompletion(transcript),
    fillerWordsFound,
    pauseAnnotations
  }
}

export default scoreDeterministic
