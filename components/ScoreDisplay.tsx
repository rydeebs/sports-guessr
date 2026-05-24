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
    <div className="glass-dark rounded-[1.75rem] px-5 py-4 text-right shadow-2xl">
      <p className="font-sans text-sm font-semibold uppercase text-white/72">
        Round {currentRound}/{totalRounds}
      </p>
      <p className="mt-1 font-serif text-3xl leading-none text-white">
        {totalScore.toLocaleString()}
      </p>
      <p className="mt-1 font-sans text-xs font-semibold uppercase text-white/60">
        Total score
      </p>
    </div>
  );
}
