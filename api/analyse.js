import process from 'node:process';
import { checkRateLimit } from './_rateLimit.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Server-side deterministic — mirrors scoring.js but works on plain text.
// After FIX 1: only HARD_FILLERS count toward fillerWordScore.
// After FIX 2: MAX_PAUSE_SCORE = 15, deduct 3 per bad pause.
const HARD_FILLER_SET = new Set(['um', 'uh', 'erm', 'hmm', 'ah']);
const INCOMPLETE_ENDINGS = new Set([
  'a', 'an', 'and', 'as', 'because', 'but', 'for', 'if', 'in', 'of', 'or',
  'so', 'than', 'that', 'the', 'then', 'to', 'when', 'where', 'which', 'while', 'with',
]);

function serverDeterministicScore(transcript, pauseData) {
  // Hard fillers only (single tokens, no phrases)
  const words = (transcript || '').toLowerCase().replace(/[^\w\s']/g, ' ').trim().split(/\s+/).filter(Boolean);
  const hardFillerCount = words.filter(w => HARD_FILLER_SET.has(w)).length;
  const fillerWordScore = Math.max(0, Math.min(30, 30 - hardFillerCount * 3));

  // Pause quality: max 15, deduct 3 per bad pause (penalty field honoured if present)
  const annotations = Array.isArray(pauseData) ? pauseData : [];
  let pauseQualityScore = 15;
  for (const p of annotations) {
    if (p?.type === 'bad') {
      pauseQualityScore -= (typeof p.penalty === 'number' ? p.penalty : 3);
    }
  }
  pauseQualityScore = Math.max(0, pauseQualityScore);

  // Sentence completion
  const raw = (transcript || '').trim();
  const lastWord = raw.split(/\s+/).pop()?.toLowerCase().replace(/[^\w]/g, '') || '';
  let completionScore = 10;
  if (!/[.!?]$/.test(raw)) completionScore -= 2;
  if (INCOMPLETE_ENDINGS.has(lastWord)) completionScore -= 5;
  completionScore = Math.max(0, completionScore);

  return fillerWordScore + pauseQualityScore + completionScore;
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') return JSON.parse(body);
  return body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deviceId = req.headers['x-device-id'];
  const rateLimit = await checkRateLimit(deviceId, 'analyse');
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: 'limit_reached', remaining: rateLimit.remaining });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'Missing GROQ_API_KEY' });
  }

  let body;
  try {
    body = parseBody(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { transcript, word, context, pauseData, softFillerFlags } = body;

  if (!transcript || !word) {
    return res.status(400).json({ error: 'Missing transcript or word' });
  }

  // Format soft filler flags for the prompt, if any were pre-flagged by the deterministic layer
  const softFillerSection = Array.isArray(softFillerFlags) && softFillerFlags.length > 0
    ? `\nThe deterministic layer pre-flagged these words as possible soft fillers (context-dependent):\n${softFillerFlags.map(f => `  - "${f.word}" at word position ${f.position} (reason: ${f.reason})`).join('\n')}\nFor each, decide if it is a genuine filler in this context or legitimate speech. Return confirmed filler positions in confirmedSoftFillerPositions.`
    : '';

  const prompt = `Analyse this spoken response. The speaker was asked to use the word "${word}" naturally.

Context given to the speaker: "${context || 'none provided'}"

Transcript: "${transcript}"
${softFillerSection}
Score strictly. Do not inflate scores. Average real speech scores 12-15.

naturalWordScore (0-20):
  18-20 = completely natural, felt organic
  10-13 = technically used but forced
  0-9 = not used or very awkward

clarityScore (0-20):
  18-20 = clear argument, confident structure
  10-13 = understandable but rambling
  0-9 = hard to follow or incoherent

Return ONLY this JSON object, no other text:
{"naturalWordScore":<0-20>,"clarityScore":<0-20>,"feedbackPoints":[{"text":"<one concise sentence under 100 chars>","positive":<true|false>}],"fillerWordPositions":[<0-based word indices of hard filler words: um, uh, erm, hmm, ah>],"confirmedSoftFillerPositions":[<word positions from the pre-flagged list that are genuine fillers in this context>]}

feedbackPoints: 2-3 items. positive:true for strengths, positive:false for areas to improve. Be specific to the actual content.`;

  const groqRes = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a speech analysis assistant. Return ONLY a valid JSON object. No other text. Be strict — do not inflate scores.',
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

  const naturalWordScore = Math.min(20, Math.max(0, Math.round(Number(llm.naturalWordScore) || 0)));
  const clarityScore     = Math.min(20, Math.max(0, Math.round(Number(llm.clarityScore) || 0)));

  const feedbackPoints = Array.isArray(llm.feedbackPoints)
    ? llm.feedbackPoints
        .slice(0, 3)
        .filter(p => p && typeof p.text === 'string')
        .map(p => ({ text: String(p.text).trim(), positive: Boolean(p.positive) }))
    : [];

  const fillerWordPositions = Array.isArray(llm.fillerWordPositions)
    ? llm.fillerWordPositions.filter(p => Number.isInteger(p) && p >= 0)
    : [];

  // Confirmed soft fillers — validate against the pre-flagged positions so LLM can't hallucinate new ones
  const allowedSoftPositions = new Set(
    Array.isArray(softFillerFlags) ? softFillerFlags.map(f => f.position) : []
  );
  const confirmedSoftFillerPositions = Array.isArray(llm.confirmedSoftFillerPositions)
    ? llm.confirmedSoftFillerPositions.filter(p => Number.isInteger(p) && allowedSoftPositions.has(p))
    : [];

  const deterministicTotal = serverDeterministicScore(transcript, pauseData);
  const fluencyScore = Math.min(100, deterministicTotal + naturalWordScore + clarityScore);

  return res.status(200).json({
    naturalWordScore,
    clarityScore,
    feedbackPoints,
    fillerWordPositions,
    confirmedSoftFillerPositions,
    fluencyScore,
  });
}
