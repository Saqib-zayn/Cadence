import { getDeviceId } from './deviceId.js';

export async function generateContext(word, category = 'random') {
  const cacheKey = `cadence_ctx_${word.toLowerCase()}_${category}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch('/api/generate-context', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
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

  console.log('Audio blob:', blob.type, blob.size, 'bytes')
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: {
      'x-device-id': getDeviceId(),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Transcription failed');
  }

  return res.json();
}

export async function analyseRound({ transcript, word, context, pauseData }) {
  const res = await fetch('/api/analyse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': getDeviceId(),
    },
    body: JSON.stringify({ transcript, word, context, pauseData }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Analysis failed');
  }

  return res.json();
}
