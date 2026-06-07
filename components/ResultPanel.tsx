import type { Round, ScoreResult } from "@/types/game";

type ResultPanelProps = {
  round: Round;
  result: ScoreResult;
  isLastRound: boolean;
  onNextRound: () => void;
};

export function ResultPanel({
  round,
  result,
  isLastRound,
  onNextRound,
}: ResultPanelProps) {
  return (
    <aside className="result-panel glass-panel w-[min(32rem,calc(100vw-1.5rem))] p-4 text-[#0d1a26] shadow-2xl sm:p-6">
      <p className="result-kicker font-sans text-xs font-black uppercase">
        Result
      </p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-[#07111d] sm:text-3xl">
        {round.title}
      </h2>
      {result.timedOut ? (
        <p className="mt-2 rounded-full bg-[#fee2e2] px-3 py-1.5 font-sans text-xs font-black uppercase text-[#b91c1c]">
          Time expired
        </p>
      ) : null}
      <p className="mt-2 font-sans text-sm text-[#465251]">
        {round.actualLocation.name}, {round.actualLocation.city},{" "}
        {round.actualLocation.country} · {formatRoundDate(round)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 font-sans sm:mt-5 sm:gap-2.5">
        <ResultStat
          label="Distance error"
          value={
            result.timedOut
              ? "No guess"
              : `${result.distanceMiles.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })} mi`
          }
        />
        <ResultStat
          label="Year error"
          value={result.timedOut ? "No guess" : `${result.yearError} yr`}
        />
      </div>
      <div className="result-score-card mt-3 bg-[#1f2934] px-4 py-3 text-white sm:py-4">
        <p className="font-sans text-xs font-bold uppercase">
          Round score
        </p>
        <p className="font-serif text-3xl leading-none sm:text-4xl">
          {result.roundScore.toLocaleString()}
        </p>
      </div>
      <button
        className="sport-action result-next-button mt-4 w-full px-5 py-3 font-sans text-sm font-black uppercase text-white shadow-lg transition"
        onClick={onNextRound}
        type="button"
      >
        {isLastRound ? "See Results" : "Next Round"}
      </button>
    </aside>
  );
}

function formatRoundDate(round: Round) {
  return `${round.actualMonth} ${round.actualDay}, ${round.actualYear}`;
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-stat-card bg-white/68 p-3 shadow-sm">
      <p className="text-[0.68rem] font-black uppercase text-[#5d6968]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[#0d1a26]">{value}</p>
    </div>
  );
}
