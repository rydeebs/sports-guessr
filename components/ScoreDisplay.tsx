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
  const maxScore = totalRounds * 1000;

  return (
    <div className="score-display glass-dark shadow-2xl">
      <div className="score-display-segment">
        <p>Round</p>
        <strong>
          {currentRound}<span>/{totalRounds}</span>
        </strong>
      </div>
      <div className="score-display-segment score-display-points">
        <p>Score</p>
        <strong>
          {totalScore.toLocaleString()}
          <span>/{maxScore.toLocaleString()}</span>
        </strong>
      </div>
    </div>
  );
}
