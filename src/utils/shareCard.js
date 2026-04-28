import html2canvas from 'html2canvas';

export function generateShareText(score, word) {
  if (score >= 90) return `Just hit ${score} on Cadence 🔥 — can you?`;
  if (score >= 75) return `Scored ${score} on '${word}' — pretty happy with that one`;
  if (score >= 50) return `Humbling myself on Cadence (${score}/100)... filler words everywhere 😅`;
  return `Starting from the bottom on Cadence (${score}/100) — watch this space`;
}

export async function generateShareCard(element) {
  const canvas = await html2canvas(element, {
    scale: 1,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: null,
  });

  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(URL.createObjectURL(blob)), 'image/png');
  });
}

export async function triggerShare(blobUrl, text) {
  if (navigator.share) {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      const file = new File([blob], 'cadence-score.png', { type: 'image/png' });
      await navigator.share({ title: 'Cadence', text, files: [file] });
    } catch {
      // Files sharing failed (some browsers don't support files in share) — share text only
      try {
        await navigator.share({ title: 'Cadence', text });
      } catch {
        // User cancelled or share not supported — silent
      }
    }
  } else {
    // Desktop: download the image
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'cadence-score.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  URL.revokeObjectURL(blobUrl);
}
