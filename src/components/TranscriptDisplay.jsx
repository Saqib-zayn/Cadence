export default function TranscriptDisplay({ words, fillerIndices, badPauseIndices, goodPauseIndices }) {
  if (!words?.length) return null;

  return (
    <div>
      <p className="text-body text-text-primary leading-relaxed">
        {words.map((w, i) => {
          const text = w.word.trim();
          const spacedText = i < words.length - 1 ? text + ' ' : text;
          const isFiller = fillerIndices.has(i);
          const hasBadPause = badPauseIndices.has(i);
          const hasGoodPause = goodPauseIndices.has(i);

          if (isFiller) {
            return (
              <span key={i} className="bg-red-mark text-red-text rounded-sm px-[2px]">
                {spacedText}
              </span>
            );
          }
          if (hasBadPause) {
            return (
              <span key={i} className="underline decoration-[3px] decoration-amber-mark underline-offset-[2px]">
                {spacedText}
              </span>
            );
          }
          if (hasGoodPause) {
            return (
              <span key={i} className="bg-green-mark rounded-sm px-[2px]">
                {spacedText}
              </span>
            );
          }
          return <span key={i}>{spacedText}</span>;
        })}
      </p>

      <div className="mt-[24px] pt-[16px] border-t border-border flex flex-wrap gap-[16px]">
        <div className="flex items-center gap-[6px]">
          <div className="w-[8px] h-[8px] rounded-sm bg-red-mark flex-shrink-0" />
          <span className="text-caption text-text-muted">Filler words</span>
        </div>
        <div className="flex items-center gap-[6px]">
          <div className="w-[10px] h-[2px] bg-amber-mark flex-shrink-0" />
          <span className="text-caption text-text-muted">Mid-sentence pause</span>
        </div>
        <div className="flex items-center gap-[6px]">
          <div className="w-[8px] h-[8px] rounded-sm bg-green-mark flex-shrink-0" />
          <span className="text-caption text-text-muted">End-sentence pause</span>
        </div>
      </div>
    </div>
  );
}
