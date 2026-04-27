import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function MicPermissionScreen() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);

  async function handleAllow() {
    setRequesting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(t => t.stop());
      });
      localStorage.setItem('cadence_mic_shown', '1');
      if (state?.next) {
        navigate(state.next.path, { state: state.next.state });
      } else {
        navigate('/');
      }
    } catch {
      setDenied(true);
      setRequesting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col items-start justify-center px-[24px] md:px-[48px] max-w-[520px] mx-auto">
      <div className="mb-[32px]">
        <span className="material-symbols-outlined text-text-muted mb-[16px] block" style={{ fontSize: '40px' }}>
          mic
        </span>
        <h1 className="text-heading-1 text-text-primary mb-[12px]">
          Your voice stays on your device
        </h1>
        <p className="text-body text-text-secondary">
          Audio is sent to Groq for transcription and immediately discarded.
          Nothing is stored on a server. No account needed.
        </p>
      </div>

      {denied && (
        <div className="bg-red-bg border border-red-mark rounded-lg p-[16px] mb-[24px] w-full">
          <p className="text-body-medium text-red-text">Microphone access was denied.</p>
          <p className="text-caption text-text-secondary mt-[4px]">
            Check your browser settings to allow mic access, then try again.
          </p>
        </div>
      )}

      <button
        onClick={handleAllow}
        disabled={requesting}
        className="w-full h-[52px] bg-btn-primary-bg text-btn-primary-text text-body-medium rounded-md disabled:opacity-60"
      >
        {requesting ? 'Requesting access...' : 'Got it — allow mic'}
      </button>
    </div>
  );
}
