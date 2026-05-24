type ScoreDisplayProps = {
  currentRound: number;
  totalRounds: number;
  totalScore: number;
};

export function ScoreDisplay({
  currentRound,
  totalRounds,
  totalScore,
}: ScoreDisplayProps) {
  return (
    <div className="score-display glass-dark rounded-[1.25rem] px-3 py-2 text-right shadow-2xl sm:rounded-[1.75rem] sm:px-5 sm:py-4">
      <p className="font-sans text-[0.65rem] font-semibold uppercase text-white/72 sm:text-sm">
        Round {currentRound}/{totalRounds}
      </p>
      <p className="mt-0.5 font-serif text-xl leading-none text-white sm:mt-1 sm:text-3xl">
        {totalScore.toLocaleString()}
      </p>
      <p className="mt-0.5 font-sans text-[0.58rem] font-semibold uppercase text-white/60 sm:mt-1 sm:text-xs">
        Total score
      </p>
    </div>
  );
}
