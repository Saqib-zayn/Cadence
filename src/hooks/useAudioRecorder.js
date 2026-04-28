import { useState, useRef, useCallback } from 'react';

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [volumeData, setVolumeData] = useState([]);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const volumeIntervalRef = useRef(null);
  const maxDurationTimerRef = useRef(null);
  const volumeDataRef = useRef([]);
  const startTimeRef = useRef(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setVolumeData([]);
    volumeDataRef.current = [];
    chunksRef.current = [];

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(err.message || 'Microphone permission denied');
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioCtx();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);

    startTimeRef.current = Date.now();

    volumeIntervalRef.current = setInterval(() => {
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const timestamp = Date.now() - startTimeRef.current;
      volumeDataRef.current.push([timestamp, rms]);
      // Sync reactive state every 5 ticks (~250ms) to avoid thrashing renders
      if (volumeDataRef.current.length % 5 === 0) {
        setVolumeData([...volumeDataRef.current]);
      }
    }, 50);

    const mimeType = getSupportedMimeType();
    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const finalMime = mimeType || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type: finalMime });
      stream.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (blob.size < 1000) {
        setError('Recording failed. Please check your mic and try again.');
        return;
      }
      setAudioBlob(blob);
      setVolumeData([...volumeDataRef.current]);
    };

    mediaRecorder.start();
    setIsRecording(true);

    maxDurationTimerRef.current = setTimeout(() => {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }, 45000);
  }, []);

  const stopRecording = useCallback(() => {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return { startRecording, stopRecording, isRecording, audioBlob, volumeData, error };
}
