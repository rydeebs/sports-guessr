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
    <div className="score-display glass-dark flex items-center gap-2 rounded-[1.25rem] px-3 py-2 text-right shadow-2xl sm:gap-3 sm:rounded-[1.75rem] sm:px-5 sm:py-3">
      <p className="font-sans text-[0.65rem] font-semibold uppercase leading-none text-white/72 sm:text-sm">
        Round {currentRound}/{totalRounds}
      </p>
      <p className="font-serif text-xl leading-none text-white sm:text-3xl">
        {totalScore.toLocaleString()}
      </p>
    </div>
  );
}
