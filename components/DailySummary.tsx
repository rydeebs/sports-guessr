"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ScoreResult } from "@/types/game";
import type { CompletedRound } from "@/utils/supabase/gameSync";
import {
  createChallenge,
  getShareUrl,
  openSocialShare,
  readChallengeLeaderboard,
  readDailyLeaderboard,
  shareText,
  type Challenge,
  type LeaderboardEntry,
} from "@/utils/supabase/challenges";

type DailySummaryProps = {
  activeDate: string;
  archivedDates: string[];
  challenge: Challenge | null;
  completedRounds: CompletedRound[];
  scoreHistory: ScoreResult[];
  totalScore: number;
  onSelectDate: (date: string) => void;
};

export function DailySummary({
  activeDate,
  archivedDates,
  challenge,
  completedRounds,
  scoreHistory,
  totalScore,
  onSelectDate,
}: DailySummaryProps) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [shareStatus, setShareStatus] = useState("");
  const [challengeUrl, setChallengeUrl] = useState("");
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const displayDate = formatPlayDate(activeDate);
  const maxScore = scoreHistory.length * 1000;
  const selectedRound = completedRounds[selectedRoundIndex];
  const averageRoundScore = scoreHistory.length
    ? Math.round(totalScore / scoreHistory.length)
    : 0;
  const bestRoundScore = scoreHistory.reduce(
    (best, score) => Math.max(best, score.roundScore),
    0,
  );

  useEffect(() => {
    readDailyLeaderboard(activeDate).then(setLeaderboard);
  }, [activeDate, totalScore]);

  useEffect(() => {
    if (!challenge) {
      setChallengeLeaderboard([]);
      return;
    }

    readChallengeLeaderboard(challenge.id).then(setChallengeLeaderboard);
  }, [challenge, totalScore]);

  const shareDailyScore = async () => {
    const url = await getShareUrl(`/?date=${encodeURIComponent(activeDate)}`);
    const status = await shareText({
      text: `I scored ${totalScore.toLocaleString()} on MomentGuessr for ${displayDate}.`,
      title: "MomentGuessr Daily Score",
      url,
    });

    setShareStatus(status === "shared" ? "Shared" : "Link copied");
  };

  const createFriendChallenge = async () => {
    setShareStatus("");
    setIsCreatingChallenge(true);

    try {
      const nextChallenge = await createChallenge(activeDate);
      const url = await getShareUrl(
        `/?challenge=${encodeURIComponent(nextChallenge.id)}`,
      );
      setChallengeUrl(url);
      const status = await shareText({
        text: `Can you beat my ${totalScore.toLocaleString()} on MomentGuessr?`,
        title: "MomentGuessr Challenge",
        url,
      });

      setShareStatus(status === "shared" ? "Challenge shared" : "Challenge copied");
    } catch (error) {
      setShareStatus(
        error instanceof Error ? error.message : "Could not create challenge",
      );
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  const shareToSocial = async (network: "facebook" | "x") => {
    const url = challengeUrl || (await getShareUrl(`/?date=${activeDate}`));
    openSocialShare(network, {
      text: `I scored ${totalScore.toLocaleString()} on MomentGuessr for ${displayDate}.`,
      url,
    });
  };

  return (
    <main className="daily-summary min-h-screen px-4 py-6 text-white sm:px-6">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <p className="font-serif text-3xl leading-none sm:text-4xl">
          MomentGuessr
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            className="sport-panel rounded-full px-4 py-2 font-sans text-xs font-black uppercase text-white/76 transition hover:text-white"
            href="/archive"
          >
            Archive
          </Link>
          <Link
            className="sport-panel rounded-full px-4 py-2 font-sans text-xs font-black uppercase text-white/76 transition hover:text-white"
            href="/state"
          >
            Leaderboard
          </Link>
          <button
            aria-expanded={isArchiveOpen}
            className="sport-panel rounded-full px-4 py-2 font-sans text-xs font-black uppercase text-white/76 transition hover:text-white"
            onClick={() => setIsArchiveOpen((open) => !open)}
            type="button"
          >
            {displayDate}
          </button>
        </div>
      </header>
      {isArchiveOpen ? (
        <section className="sport-panel mx-auto mt-4 w-full max-w-6xl rounded-[1.5rem] p-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-black uppercase text-[#78b7ff]">
                Archive
              </p>
              <p className="mt-1 font-sans text-sm text-white/64">
                Select a prior day to play.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {archivedDates.map((date) => (
                <button
                  className={`rounded-full border px-4 py-2 font-sans text-xs font-black uppercase transition ${
                    date === activeDate
                      ? "border-[#78b7ff]/65 bg-[#78b7ff]/18 text-white"
                      : "border-white/14 bg-white/8 text-white/78 hover:bg-white/14 hover:text-white"
                  }`}
                  key={date}
                  onClick={() => onSelectDate(date)}
                  type="button"
                >
                  {formatPlayDate(date)}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <section className="mx-auto mt-10 grid w-full max-w-6xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="sport-panel rounded-[2rem] p-6 shadow-2xl sm:p-8">
          <p className="font-sans text-xs font-black uppercase text-[#78b7ff]">
            Total points
          </p>
          <h1 className="mt-3 font-serif text-7xl leading-none sm:text-8xl">
            {totalScore.toLocaleString()}
          </h1>
          <p className="mt-3 max-w-lg font-sans text-sm text-white/68">
            Five sports moments scored out of {maxScore.toLocaleString()} points
            for location and year accuracy.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            {scoreHistory.map((score, index) => (
              <button
                className={`rounded-[1.15rem] border p-3 text-left transition hover:bg-white/14 ${
                  selectedRoundIndex === index
                    ? "border-[#f0c46a]/80 bg-[#f0c46a]/16"
                    : "border-white/12 bg-white/8"
                }`}
                key={`round-${index + 1}`}
                onClick={() => setSelectedRoundIndex(index)}
                type="button"
              >
                <p className="font-sans text-[0.65rem] font-black uppercase text-white/52">
                  Round {index + 1}
                </p>
                <p className="mt-1 font-serif text-2xl">
                  {score.roundScore.toLocaleString()}
                </p>
              </button>
            ))}
          </div>
          {selectedRound ? (
            <section className="mt-5 rounded-[1.15rem] border border-white/12 bg-white/8 p-4">
              <p className="font-sans text-xs font-black uppercase text-[#f0c46a]">
                Round {selectedRoundIndex + 1} Review
              </p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">
                {selectedRound.round.title}
              </h2>
              <p className="mt-2 font-sans text-sm text-white/68">
                Your guess:{" "}
                {selectedRound.guess.location
                  ? `${selectedRound.guess.year}, ${selectedRound.guess.location.lat.toFixed(2)}, ${selectedRound.guess.location.lng.toFixed(2)}`
                  : "No guess"}
              </p>
              <p className="mt-1 font-sans text-sm text-white/68">
                Answer: {selectedRound.round.actualYear},{" "}
                {selectedRound.round.actualLocation.name},{" "}
                {selectedRound.round.actualLocation.country}
              </p>
              <p className="mt-3 font-sans text-sm text-white/76">
                {selectedRound.round.description}
              </p>
            </section>
          ) : null}
          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <SummaryStat label="Average Round" value={averageRoundScore} />
            <SummaryStat label="Best Round" value={bestRoundScore} />
            <SummaryStat label="Max Score" value={maxScore} />
          </section>
          <section className="mt-5 rounded-[1.15rem] border border-white/12 bg-white/8 p-4">
            <p className="font-sans text-xs font-black uppercase text-[#f0c46a]">
              Scoring
            </p>
            <p className="mt-2 font-sans text-sm text-white/70">
              Each round is worth 1,000 points: up to 500 for location and up to
              500 for the year. Country matches protect a chunk of location
              credit, and exact month/day are shown as context after the round.
            </p>
          </section>
          <div className="share-card mt-8">
            <div className="share-score-card">
              <div>
                <p className="share-card-label">Shareable Score</p>
                <p className="share-card-title">{displayDate}</p>
              </div>
              <div className="share-card-score">
                {totalScore.toLocaleString()}
              </div>
            </div>
            <div className="share-card-actions">
              <button
                className="share-neon-button share-neon-button-primary"
                onClick={shareDailyScore}
                type="button"
              >
                Share Score
              </button>
              <button
                className="share-neon-button share-neon-button-challenge"
                disabled={isCreatingChallenge}
                onClick={createFriendChallenge}
                type="button"
              >
                {isCreatingChallenge ? "Creating..." : "Challenge Friend"}
              </button>
              <button
                className="share-neon-button"
                onClick={() => shareToSocial("x")}
                type="button"
              >
                Post on X
              </button>
              <button
                className="share-neon-button"
                onClick={() => shareToSocial("facebook")}
                type="button"
              >
                Facebook
              </button>
            </div>
            {shareStatus ? (
              <p className="share-card-status">{shareStatus}</p>
            ) : null}
            {challengeUrl ? (
              <p className="share-card-url">{challengeUrl}</p>
            ) : null}
          </div>
          <button
            className="sport-action mt-5 rounded-full px-7 py-3 font-sans text-sm font-black uppercase text-white shadow-xl transition"
            onClick={() => setIsArchiveOpen(true)}
            type="button"
          >
            Play Different Day
          </button>
        </div>
        <aside className="sport-panel rounded-[2rem] p-6 shadow-2xl sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-sans text-xs font-black uppercase text-[#78b7ff]">
                Leaderboard
              </p>
              <h2 className="mt-2 font-serif text-4xl">Today</h2>
            </div>
            <p className="font-sans text-xs font-bold uppercase text-white/48">
              Live
            </p>
          </div>
          <ol className="mt-6 space-y-2">
            {leaderboard.length ? leaderboard.map((entry) => (
              <li
                className="flex items-center justify-between gap-4 rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 font-sans"
                key={`${entry.userId}-${entry.rank}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 text-sm font-black text-white/46">
                    #{entry.rank}
                  </span>
                  <span className="font-semibold">{entry.displayName}</span>
                </div>
                <span className="font-black">
                  {entry.score.toLocaleString()}
                </span>
              </li>
            )) : (
              <li className="rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 font-sans text-sm text-white/64">
                Sign in and finish a game to appear here.
              </li>
            )}
          </ol>
          {challenge ? (
            <section className="mt-6 border-t border-white/10 pt-5">
              <p className="font-sans text-xs font-black uppercase text-[#78b7ff]">
                Challenge
              </p>
              <h3 className="mt-1 font-serif text-3xl">Friends</h3>
              <ol className="mt-4 space-y-2">
                {challengeLeaderboard.length ? (
                  challengeLeaderboard.map((entry) => (
                    <li
                      className="flex items-center justify-between gap-4 rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 font-sans"
                      key={`${entry.userId}-${entry.rank}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 text-sm font-black text-white/46">
                          #{entry.rank}
                        </span>
                        <span className="font-semibold">{entry.displayName}</span>
                      </div>
                      <span className="font-black">
                        {entry.score.toLocaleString()}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3 font-sans text-sm text-white/64">
                    Challenge scores appear after friends finish.
                  </li>
                )}
              </ol>
            </section>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

function formatPlayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[1.15rem] border border-white/12 bg-white/8 p-3">
      <p className="font-sans text-[0.65rem] font-black uppercase text-white/52">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl">{value.toLocaleString()}</p>
    </div>
  );
}
