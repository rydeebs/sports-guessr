"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DailyScoreHistory } from "@/types/history";
import { readDailyHistory } from "@/utils/history";

export default function StatePage() {
  const [history, setHistory] = useState<DailyScoreHistory[]>([]);

  useEffect(() => {
    setHistory(readDailyHistory());
  }, []);

  const stats = useMemo(() => {
    const gamesPlayed = history.length;
    const totalPoints = history.reduce(
      (total, entry) => total + entry.totalScore,
      0,
    );
    const bestScore = history.reduce(
      (best, entry) => Math.max(best, entry.totalScore),
      0,
    );
    const averageScore = gamesPlayed
      ? Math.round(totalPoints / gamesPlayed)
      : 0;
    const roundsPlayed = history.reduce(
      (total, entry) => total + entry.roundScores.length,
      0,
    );

    return { averageScore, bestScore, gamesPlayed, roundsPlayed, totalPoints };
  }, [history]);

  return (
    <main className="state-page min-h-screen px-4 py-5 text-[#0d1a26] sm:px-6">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div>
          <p className="font-sans text-xs font-black uppercase text-[#566373]">
            MomentGuessr
          </p>
          <h1 className="mt-1 font-serif text-5xl leading-none">Stats</h1>
        </div>
        <Link className="state-back rounded-full px-5 py-3 font-sans text-sm font-black uppercase" href="/">
          Back to Game
        </Link>
      </header>
      <section className="mx-auto mt-5 grid w-full max-w-6xl gap-3 sm:grid-cols-3">
        <StateMetric label="Games Played" value={stats.gamesPlayed} />
        <StateMetric label="Total Points" value={stats.totalPoints} />
        <StateMetric label="Best Score" value={stats.bestScore} />
      </section>
      <section className="state-card mx-auto mt-3 w-full max-w-6xl rounded-[1.5rem] p-4">
        <div className="state-map rounded-[1.1rem] border border-[#bfccda] p-3">
          <svg aria-hidden="true" viewBox="0 0 360 180">
            <g>
              <path d="M19 45 42 24 82 27 111 43 99 59 73 61 62 80 45 77 35 99 18 91 27 67Z" />
              <path d="M93 95 117 104 127 128 112 162 94 140 87 112Z" />
              <path d="M144 33 187 27 215 40 202 57 177 58 166 73 145 62Z" />
              <path d="M184 65 216 64 236 84 226 121 202 126 184 99Z" />
              <path d="M214 35 287 29 337 48 326 79 292 73 272 92 244 84 238 61Z" />
              <path d="M278 111 313 107 337 130 324 154 289 145Z" />
            </g>
          </svg>
        </div>
      </section>
      <section className="mx-auto mt-3 grid w-full max-w-6xl gap-3 sm:grid-cols-3">
        <StateMetric label="Average Score" value={stats.averageScore} />
        <StateMetric label="Rounds Played" value={stats.roundsPlayed} />
        <StateMetric label="Saved Days" value={stats.gamesPlayed} />
      </section>
      <section className="state-card mx-auto mt-3 w-full max-w-6xl rounded-[1.5rem] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-black uppercase text-[#566373]">
              Score History
            </p>
            <h2 className="mt-1 font-serif text-3xl">Daily Games</h2>
          </div>
        </div>
        <div className="state-table mt-4 overflow-hidden rounded-[1rem] border border-[#bfccda]">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#edf3f8] px-4 py-2 font-sans text-xs font-black uppercase text-[#566373]">
            <span>Day</span>
            <span>Total</span>
            <span>Rounds</span>
          </div>
          {history.length ? (
            history.map((entry) => (
              <div
                className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-[#d3dde8] px-4 py-3 font-sans text-sm"
                key={entry.date}
              >
                <span className="font-semibold">{formatScoreDate(entry.date)}</span>
                <span className="font-black">{entry.totalScore.toLocaleString()}</span>
                <span className="text-[#566373]">{entry.roundScores.length}</span>
              </div>
            ))
          ) : (
            <p className="border-t border-[#d3dde8] px-4 py-5 font-sans text-sm text-[#566373]">
              Finish a daily game to populate player history.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function StateMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="state-card rounded-[1.15rem] p-4">
      <p className="font-sans text-[0.65rem] font-black uppercase text-[#566373]">
        {label}
      </p>
      <p className="mt-2 font-serif text-4xl leading-none">
        {value.toLocaleString()}
      </p>
    </article>
  );
}

function formatScoreDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
