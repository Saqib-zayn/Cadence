import process from 'node:process';
import { checkRateLimit } from './_rateLimit.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const HARD_FILLER_SET = new Set(['um', 'uh', 'erm', 'hmm', 'ah']);
const INCOMPLETE_ENDINGS = new Set([
  'a', 'an', 'and', 'as', 'because', 'but', 'for', 'if', 'in', 'of', 'or',
  'so', 'than', 'that', 'the', 'then', 'to', 'when', 'where', 'which', 'while', 'with',
]);

// Mirrors scoring.js — hard fillers (max 20), pacing WPM (max 15), sentence completion (max 10)
function serverDeterministicScore(transcript, transcriptDuration) {
  const words = (transcript || '').toLowerCase().replace(/[^\w\s']/g, ' ').trim().split(/\s+/).filter(Boolean);
  const hardFillerCount = words.filter(w => HARD_FILLER_SET.has(w)).length;
  const fillerWordScore = Math.max(0, Math.min(20, 20 - hardFillerCount * 3));

  let pacingScore = 0;
  const dur = Number(transcriptDuration);
  if (dur > 0 && words.length > 0) {
    const wpm = (words.length / dur) * 60;
    if (wpm >= 110 && wpm <= 160) pacingScore = 15;
    else if ((wpm >= 90 && wpm < 110) || (wpm > 160 && wpm <= 180)) pacingScore = 10;
    else pacingScore = 5;
  }

  const raw = (transcript || '').trim();
  const lastWord = raw.split(/\s+/).pop()?.toLowerCase().replace(/[^\w]/g, '') || '';
  let completionScore = 10;
  if (!/[.!?]$/.test(raw)) completionScore -= 2;
  if (INCOMPLETE_ENDINGS.has(lastWord)) completionScore -= 5;
  completionScore = Math.max(0, completionScore);

  return {
    fillerWordScore,
    pacingScore,
    completionScore,
    total: fillerWordScore + pacingScore + completionScore,
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
  "contextFit": {"score": <0-5>, "reason": "<one sentence>"},
  "naturalWordUsage": {"score": <0-15>, "reason": "<one sentence>"},
  "clarityOfThought": {"score": <0-20>, "reason": "<one sentence>"},
  "structure": {"score": <0-15>, "reason": "<one sentence>"},
  "authority": {"score": <0-5>, "reason": "<one sentence>"},
  "softFillerClassification": [{"position": <int>, "word": "<word>", "isFiller": <true|false>}],
  "weakLanguage": [{"phrase": "<exact phrase from transcript>", "startIndex": <0-based word position>, "suggestion": "<stronger replacement>"}],
  "feedbackPoints": [{"type": "strength"|"improvement", "message": "<concise sentence under 100 chars>"}],
  "oneLineSummary": "<15 words or fewer>",
  "suggestedRetryFocus": "<one actionable tip under 80 chars>"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deviceId = req.headers['x-device-id'];
  const rateLimit = await checkRateLimit(deviceId, 'analyse', req.headers['x-dev-token']);
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'limit_reached' });
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

  const { transcript, word, context, contextCategory, transcriptDuration, softFillerFlags } = body;

  if (!transcript || !word) {
    return res.status(400).json({ error: 'Missing transcript or word' });
  }

  const det = serverDeterministicScore(transcript, transcriptDuration);
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
Do NOT count hard fillers (um, uh, erm, hmm, ah) — those are scored separately. Score only the five qualitative dimensions below. Score strictly; do not inflate. If soft fillers were confirmed above, let them reduce clarityOfThought or structure as appropriate — do not apply a separate deduction.

contextFit (0-5): how well the response suits the given context and scenario
naturalWordUsage (0-15): how organically "${word}" was used — penalise forced or mechanical use
clarityOfThought (0-20): coherence and ease of understanding — penalise rambling or contradictions
structure (0-15): logical flow, opening and closing — penalise unfinished or disorganised thoughts
authority (0-5): confidence and command of the topic — penalise hedging or uncertain delivery

weakLanguage: identify phrases that weaken the response — trailing or vague phrases such as "and yeah", "and stuff", "or whatever", "you know what I mean", "I guess", "kind of", "sort of", "things like that", "stuff like that". Only flag when they genuinely reduce impact. Return startIndex as the 0-based word position of the first word of the phrase in the transcript. Maximum 3 flags. Return an empty array if none found. Each confirmed weak language instance should reduce your clarityOfThought score by 2 points and your structure score by 1 point. Cap the total weak language penalty at 6 points across both fields combined.
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

  const contextFitScore       = clamp(llm.contextFit?.score,        0,  5);
  const naturalWordUsageScore = clamp(llm.naturalWordUsage?.score,   0, 15);
  const clarityScore          = clamp(llm.clarityOfThought?.score,   0, 20);
  const structureScore        = clamp(llm.structure?.score,          0, 15);
  const authorityScore        = clamp(llm.authority?.score,          0,  5);

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

  const weakLanguage = Array.isArray(llm.weakLanguage)
    ? llm.weakLanguage
        .slice(0, 3)
        .filter(e => typeof e?.phrase === 'string' && Number.isInteger(e?.startIndex) && e.startIndex >= 0)
        .map(e => ({
          phrase:      String(e.phrase).trim(),
          startIndex:  e.startIndex,
          suggestion:  typeof e.suggestion === 'string' ? e.suggestion.trim() : '',
        }))
    : [];

  // Max: det(45) + LLM excl. contextFit(55) = 100; contextFit reported but not in total
  const totalScore = det.fillerWordScore + det.pacingScore + det.completionScore
    + clarityScore + naturalWordUsageScore + structureScore + authorityScore;

  return res.status(200).json({
    fillerWordScore:          det.fillerWordScore,
    pacingScore:              det.pacingScore,
    sentenceCompletionScore:  det.completionScore,
    contextFitScore,
    naturalWordUsageScore,
    clarityScore,
    structureScore,
    authorityScore,
    softFillerClassification,
    confirmedSoftFillerPositions,
    weakLanguage,
    feedbackPoints,
    oneLineSummary,
    suggestedRetryFocus,
    totalScore,
  });
}
