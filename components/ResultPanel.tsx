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
    <aside className="result-panel glass-panel w-[min(32rem,calc(100vw-1.5rem))] rounded-[1.5rem] p-4 text-[#0d1a26] shadow-2xl sm:rounded-[2rem] sm:p-6">
      <p className="font-sans text-xs font-black uppercase text-[#246bff]">
        Result
      </p>
      <h2 className="mt-2 font-serif text-2xl leading-tight text-[#07111d] sm:text-3xl">
        {round.title}
      </h2>
      <p className="mt-2 font-sans text-sm text-[#465251]">
        {round.actualLocation.name}, {round.actualLocation.city},{" "}
        {round.actualLocation.country} · {formatRoundDate(round)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 font-sans sm:mt-5 sm:gap-2.5">
        <ResultStat
          label="Distance error"
          value={`${result.distanceMiles.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })} mi`}
        />
        <ResultStat label="Year error" value={`${result.yearError} yr`} />
      </div>
      <div className="mt-3 rounded-[1.2rem] bg-[#1f2934] px-4 py-3 text-white sm:rounded-[1.35rem] sm:py-4">
        <p className="font-sans text-xs font-bold uppercase text-[#78b7ff]">
          Round score
        </p>
        <p className="font-serif text-3xl leading-none sm:text-4xl">
          {result.roundScore.toLocaleString()}
        </p>
      </div>
      <button
        className="sport-action mt-4 w-full rounded-full px-5 py-3 font-sans text-sm font-black uppercase text-white shadow-lg transition"
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
    <div className="rounded-[1.2rem] bg-white/68 p-3 shadow-sm">
      <p className="text-[0.68rem] font-black uppercase text-[#5d6968]">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-[#0d1a26]">{value}</p>
    </div>
  );
}
