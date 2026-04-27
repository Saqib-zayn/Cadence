import process from 'node:process';
import { checkRateLimit } from './_rateLimit.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

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

  const { transcript, word, context } = body;

  if (!transcript || !word) {
    return res.status(400).json({ error: 'Missing transcript or word' });
  }

  const prompt = `Analyse this spoken response. The speaker was asked to use the word "${word}" naturally.

Context given to the speaker: "${context || 'none provided'}"

Transcript: "${transcript}"

Score strictly. Do not inflate scores. Average real speech scores 12-15.

naturalWordScore (0-20):
  18-20 = completely natural, felt organic
  14-17 = natural but slightly rehearsed
  10-13 = technically used but clearly forced or shoehorned
  5-9 = awkward, didn't fit the context
  0-4 = not used, or so awkward it hurt the response

clarityScore (0-20):
  18-20 = clear argument, confident structure, strong point
  14-17 = mostly clear with minor tangents
  10-13 = understandable but rambling
  5-9 = hard to follow, no clear point
  0-4 = incoherent

Return ONLY this JSON object, no other text:
{"naturalWordScore":<0-20>,"clarityScore":<0-20>,"feedbackPoints":[{"text":"<one concise sentence>","positive":<true|false>}]}

Rules for feedbackPoints: 2-3 items. Each is one sentence under 100 characters. positive:true for strengths, positive:false for areas to improve. Be specific to the actual content.`;

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
          content: 'You are a speech analysis assistant. Return ONLY a valid JSON object. No other text. Be strict — do not inflate scores.',
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
  const raw = data.choices?.[0]?.message?.content?.trim();

  if (!raw) {
    return res.status(502).json({ error: 'No response from LLM' });
  }

  let llm;
  try {
    llm = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(502).json({ error: 'Invalid LLM response', raw });
    try { llm = JSON.parse(match[0]); }
    catch { return res.status(502).json({ error: 'Invalid LLM response', raw }); }
  }

  const naturalWordScore = Math.min(20, Math.max(0, Math.round(Number(llm.naturalWordScore) || 0)));
  const clarityScore = Math.min(20, Math.max(0, Math.round(Number(llm.clarityScore) || 0)));
  const feedbackPoints = Array.isArray(llm.feedbackPoints)
    ? llm.feedbackPoints
        .slice(0, 3)
        .filter(p => p && typeof p.text === 'string')
        .map(p => ({ text: String(p.text).trim(), positive: Boolean(p.positive) }))
    : [];

  return res.status(200).json({ naturalWordScore, clarityScore, feedbackPoints });
}
