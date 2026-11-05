import { SkipToast } from "./SkipToast";

interface PlayerSkipToastsProps {
  autoSkipOpEd: boolean;
  isInsideOpening: boolean;
  isInsideEnding: boolean;
  openingStop?: number | null;
  endingStop?: number | null;
  isAutoplayCountdown: boolean;
  timeLeft: number;
  onSeek: (pos: number) => void;
  onNext: () => void;
}

export function PlayerSkipToasts({
  autoSkipOpEd,
  isInsideOpening,
  isInsideEnding,
  openingStop,
  endingStop,
  isAutoplayCountdown,
  timeLeft,
  onSeek,
  onNext,
}: PlayerSkipToastsProps) {
  return (
    <div className="absolute bottom-28 right-8 z-40 flex flex-col gap-2 pointer-events-auto">
      {!autoSkipOpEd && isInsideOpening && openingStop != null && (
        <SkipToast type="opening" targetSeconds={openingStop} onSkip={() => onSeek(openingStop)} />
      )}
      {!autoSkipOpEd && isInsideEnding && endingStop != null && (
        <SkipToast type="ending" targetSeconds={endingStop} onSkip={() => onSeek(endingStop)} />
      )}
      {isAutoplayCountdown && (
        <SkipToast type="next_episode" countdownSeconds={Math.ceil(timeLeft)} onSkip={onNext} />
      )}
    </div>
  );
}
