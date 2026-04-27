import { useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { sendAudio } from '../utils/api';

export default function AudioRecorder() {
  const { startRecording, stopRecording, isRecording, audioBlob, volumeData, error } =
    useAudioRecorder();
  const audioRef = useRef(null);
  const [transcript, setTranscript] = useState(null);
  const [transcribeError, setTranscribeError] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    if (!audioBlob || !audioRef.current) return;
    const url = URL.createObjectURL(audioBlob);
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  useEffect(() => {
    if (!audioBlob) return;
    setTranscript(null);
    setTranscribeError(null);
    setIsTranscribing(true);
    sendAudio(audioBlob)
      .then((data) => setTranscript(data))
      .catch((err) => setTranscribeError(err.message))
      .finally(() => setIsTranscribing(false));
  }, [audioBlob]);

  const currentVolume =
    volumeData.length > 0 ? volumeData[volumeData.length - 1][1] : 0;

  return (
    <div>
      <button onClick={startRecording} disabled={isRecording}>Start</button>
      <button onClick={stopRecording} disabled={!isRecording}>Stop</button>
      {isRecording && <p>Volume (RMS): {currentVolume.toFixed(4)}</p>}
      {error && <p>Error: {error}</p>}
      {audioBlob && <p>Captured {volumeData.length} volume samples</p>}
      <audio ref={audioRef} controls />

      {isTranscribing && <p>Transcribing...</p>}
      {transcribeError && <p>Transcription error: {transcribeError}</p>}
      {transcript && (
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '1rem' }}>
          {JSON.stringify(transcript, null, 2)}
        </pre>
      )}
    </div>
  );
}
