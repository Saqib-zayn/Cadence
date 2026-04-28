import { getDeviceId } from './deviceId.js';

function extraHeaders() {
  const groqKey = localStorage.getItem('cadence_groq_key');
  return groqKey ? { 'x-groq-key': groqKey } : {};
}

export async function generateContext(word, category = 'random') {
  const cacheKey = `cadence_ctx_${word.toLowerCase()}_${category}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch('/api/generate-context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
      ...extraHeaders(),
    },
    body: JSON.stringify({ word, category }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Context generation failed');
  }

  const data = await res.json();
  sessionStorage.setItem(cacheKey, JSON.stringify(data));
  return data;
}

export async function sendAudio(blob) {
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');

  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'x-device-id': getDeviceId(),
      ...extraHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Transcription failed');
  }

  return res.json();
}

export async function analyseRound({ transcript, word, context, contextCategory, pauseData, softFillerFlags }) {
  const res = await fetch('/api/analyse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
      ...extraHeaders(),
    },
    body: JSON.stringify({ transcript, word, context, contextCategory, pauseData, softFillerFlags }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Analysis failed');
  }

  return res.json();
}
