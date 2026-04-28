import { getDeviceId } from './deviceId.js';

const LIMIT_MESSAGE = "You've hit today's free practice limit. Nice work. Come back tomorrow for more rounds.";

function extraHeaders() {
  const groqKey = localStorage.getItem('cadence_groq_key');
  return groqKey ? { 'x-groq-key': groqKey } : {};
}

function handleResponse(res) {
  if (res.status === 429) throw new Error(LIMIT_MESSAGE);
  return res;
}

export async function generateContext(word, category = 'random') {
  const cacheKey = `cadence_ctx_${word.toLowerCase()}_${category}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = handleResponse(await fetch('/api/generate-context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
      ...extraHeaders(),
    },
    body: JSON.stringify({ word, category }),
  }));

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Context generation failed');
  }

  const data = await res.json();
  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}

export async function sendAudio(blob) {
  if (blob.size < 1000) {
    throw new Error('Recording too short or empty.');
  }
  if (blob.size > 4 * 1024 * 1024) {
    throw new Error('Recording too large. Please try a shorter response.');
  }

  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');

  const res = handleResponse(await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'x-device-id': getDeviceId(),
      ...extraHeaders(),
    },
    body: formData,
  }));

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.message || err.error || 'Transcription failed');
  }

  return res.json();
}

export async function analyseRound({ transcript, word, context, contextCategory, transcriptDuration, softFillerFlags }) {
  const res = handleResponse(await fetch('/api/analyse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
      ...extraHeaders(),
    },
    body: JSON.stringify({ transcript, word, context, contextCategory, transcriptDuration, softFillerFlags }),
  }));

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Analysis failed');
  }

  return res.json();
}
