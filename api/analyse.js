import process from 'node:process';
import { checkRateLimit } from './_rateLimit.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const HARD_FILLER_SET = new Set(['um', 'uh', 'erm', 'hmm', 'ah']);
const INCOMPLETE_ENDINGS = new Set([
  'a', 'an', 'and', 'as', 'because', 'but', 'for', 'if', 'in', 'of', 'or',
  'so', 'than', 'that', 'the', 'then', 'to', 'when', 'where', 'which', 'while', 'with',
]);

// Mirrors scoring.js — hard fillers only, MAX_PAUSE = 15, deduct 3 per bad pause
function serverDeterministicScore(transcript, pauseData) {
  const words = (transcript || '').toLowerCase().replace(/[^\w\s']/g, ' ').trim().split(/\s+/).filter(Boolean);
  const hardFillerCount = words.filter(w => HARD_FILLER_SET.has(w)).length;
  const fillerWordScore = Math.max(0, Math.min(30, 30 - hardFillerCount * 3));

  const annotations = Array.isArray(pauseData) ? pauseData : [];
  let pauseQualityScore = 15;
  for (const p of annotations) {
    if (p?.type === 'bad') {
      pauseQualityScore -= (typeof p.penalty === 'number' ? p.penalty : 3);
    }
  }
  pauseQualityScore = Math.max(0, pauseQualityScore);

  const raw = (transcript || '').trim();
  const lastWord = raw.split(/\s+/).pop()?.toLowerCase().replace(/[^\w]/g, '') || '';
  let completionScore = 10;
  if (!/[.!?]$/.test(raw)) completionScore -= 2;
  if (INCOMPLETE_ENDINGS.has(lastWord)) completionScore -= 5;
  completionScore = Math.max(0, completionScore);

  return {
    fillerWordScore,
    pauseQualityScore,
    completionScore,
    total: fillerWordScore + pauseQualityScore + completionScore,
  };
}

const CATEGORY_CONTEXT = {
  interview:    'This is a professional job interview scenario. Assess confidence, precise language, and structured thinking. A good response sounds composed and credible.',
  casual:       'This is casual conversation. Assess natural flow and engagement. A good response sounds relaxed but coherent.',
  presentation: 'This is a formal presentation or pitch. Assess structure, authority, and clarity of message. A good response is well-organised and impactful.',
  business:     'This is a business communication scenario. Assess professionalism, precision, and logical structure.',
  storytelling: 'This is a storytelling scenario. Assess narrative flow, vivid language, and engagement.',
};

function categoryInstruction(category) {
  return CATEGORY_CONTEXT[category] || 'Assess overall spoken communication quality.';
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

const SCHEMA_SPEC = `{
  "contextFit": {"score": <0-10>, "reason": "<one sentence>"},
  "naturalWordUsage": {"score": <0-15>, "reason": "<one sentence>"},
  "clarityOfThought": {"score": <0-20>, "reason": "<one sentence>"},
  "structure": {"score": <0-15>, "reason": "<one sentence>"},
  "authority": {"score": <0-10>, "reason": "<one sentence>"},
  "softFillerClassification": [{"position": <int>, "word": "<word>", "isFiller": <true|false>}],
  "feedbackPoints": [{"type": "strength"|"improvement", "message": "<concise sentence under 100 chars>"}],
  "oneLineSummary": "<15 words or fewer>",
  "suggestedRetryFocus": "<one actionable tip under 80 chars>"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deviceId = req.headers['x-device-id'];
  const rateLimit = await checkRateLimit(deviceId, 'analyse');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'limit_reached', remaining: rateLimit.remaining });
  }

  const groqKey = req.headers['x-groq-key'] || GROQ_API_KEY;
  if (!groqKey) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { transcript, word, context, contextCategory, pauseData, softFillerFlags } = body;

  if (!transcript || !word) {
    return res.status(400).json({ error: 'Missing transcript or word' });
  }

  const det = serverDeterministicScore(transcript, pauseData);
  const catInstruction = categoryInstruction(contextCategory);

  const softFillerSection = Array.isArray(softFillerFlags) && softFillerFlags.length > 0
    ? `\nThe deterministic layer pre-flagged these words as possible soft fillers (context-dependent):\n${softFillerFlags.map(f => `  - "${f.word}" at word position ${f.position} (reason: ${f.reason})`).join('\n')}\nFor each, return an entry in softFillerClassification with position, word, and isFiller (true/false). Only mark as filler if it genuinely disrupts flow in this context.`
    : '';

  const prompt = `You are evaluating a spoken response. Context tag: "${contextCategory || 'random'}".
${catInstruction}

The speaker was asked to use the word "${word}" naturally.
Context given to the speaker: "${context || 'none provided'}"

Transcript: "${transcript}"
${softFillerSection}
Do NOT count hard fillers (um, uh, erm, hmm, ah) — those are scored separately. Score only the five qualitative dimensions below. Score strictly; do not inflate. Average real speech scores 10-14 across the five dimensions.

contextFit (0-10): how well the response suits the given context and scenario
naturalWordUsage (0-15): how organically "${word}" was used — penalise forced or mechanical use
clarityOfThought (0-20): coherence and ease of understanding — penalise rambling or contradictions
structure (0-15): logical flow, opening and closing — penalise unfinished or disorganised thoughts
authority (0-10): confidence and command of the topic — penalise hedging or uncertain delivery

feedbackPoints: exactly 2-3 items mixing strengths and improvements; be specific to the actual content.
oneLineSummary: a single plain-language summary of the response quality, 15 words or fewer.
suggestedRetryFocus: one concrete thing the speaker should focus on in their next attempt.

Return ONLY this JSON object, no other text:
${SCHEMA_SPEC}`;

  const groqRes = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a speech coach analysing a spoken response. Return ONLY a valid JSON object matching the exact schema provided. No other text. Be honest and strict — do not inflate scores. Tailor feedback to the context tag.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
    }),
  });

  if (!groqRes.ok) {
    const errorText = await groqRes.text();
    return res.status(groqRes.status).json({ error: errorText });
  }

  const data = await groqRes.json();
  const rawContent = data.choices?.[0]?.message?.content?.trim();

  if (!rawContent) {
    return res.status(502).json({ error: 'No response from LLM' });
  }

  let llm;
  try {
    llm = JSON.parse(rawContent);
  } catch {
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'Invalid LLM response', rawContent });
    try {
      llm = JSON.parse(match[0]);
    } catch {
      return res.status(502).json({ error: 'Invalid LLM response', rawContent });
    }
  }

  const clamp = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  const contextFitScore       = clamp(llm.contextFit?.score,        0, 10);
  const naturalWordUsageScore = clamp(llm.naturalWordUsage?.score,   0, 15);
  const clarityScore          = clamp(llm.clarityOfThought?.score,   0, 20);
  const structureScore        = clamp(llm.structure?.score,          0, 15);
  const authorityScore        = clamp(llm.authority?.score,          0, 10);

  const feedbackPoints = Array.isArray(llm.feedbackPoints)
    ? llm.feedbackPoints
        .slice(0, 3)
        .filter(p => p && typeof p.message === 'string')
        .map(p => ({
          type: p.type === 'strength' ? 'strength' : 'improvement',
          message: String(p.message).trim(),
        }))
    : [];

  const allowedSoftPositions = new Set(
    Array.isArray(softFillerFlags) ? softFillerFlags.map(f => f.position) : []
  );
  const softFillerClassification = Array.isArray(llm.softFillerClassification)
    ? llm.softFillerClassification.filter(
        e => Number.isInteger(e?.position) && allowedSoftPositions.has(e.position)
      )
    : [];
  const confirmedSoftFillerPositions = softFillerClassification
    .filter(e => e.isFiller === true)
    .map(e => e.position);

  const oneLineSummary      = typeof llm.oneLineSummary === 'string'      ? llm.oneLineSummary.trim()      : '';
  const suggestedRetryFocus = typeof llm.suggestedRetryFocus === 'string' ? llm.suggestedRetryFocus.trim() : '';

  // Raw max: 55 (deterministic) + 70 (LLM) = 125
  const llmTotal   = contextFitScore + naturalWordUsageScore + clarityScore + structureScore + authorityScore;
  const rawTotal   = det.total + llmTotal;
  const totalScore = Math.min(100, Math.round(rawTotal / 125 * 100));

  return res.status(200).json({
    fillerWordScore:          det.fillerWordScore,
    pauseQualityScore:        det.pauseQualityScore,
    sentenceCompletionScore:  det.completionScore,
    contextFitScore,
    naturalWordUsageScore,
    clarityScore,
    structureScore,
    authorityScore,
    softFillerClassification,
    confirmedSoftFillerPositions,
    feedbackPoints,
    oneLineSummary,
    suggestedRetryFocus,
    totalScore,
  });
}
