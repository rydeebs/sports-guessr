"use client";

import { useEffect, useState } from "react";
import type { ScoreResult } from "@/types/game";
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
  scoreHistory: ScoreResult[];
  totalScore: number;
  onSelectDate: (date: string) => void;
};

export function DailySummary({
  activeDate,
  archivedDates,
  challenge,
  scoreHistory,
  totalScore,
  onSelectDate,
}: DailySummaryProps) {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<
    LeaderboardEntry[]
  >([]);
  const [shareStatus, setShareStatus] = useState("");
  const [challengeUrl, setChallengeUrl] = useState("");
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const displayDate = formatPlayDate(activeDate);
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
    <main className="daily-summary min-h-screen text-white">
      <div className="lb-wrap">
        <header className="lb-head">
          <img
            alt="Moment Guessr"
            className="lb-logo"
            src="/moment-popup/logo-app-white.png"
          />
          <button
            aria-expanded={isArchiveOpen}
            className="datepill"
            onClick={() => setIsArchiveOpen((open) => !open)}
            type="button"
          >
            <span className="dot" />
            {displayDate}
          </button>
        </header>
        {isArchiveOpen ? (
          <section className="archive-strip">
            <div>
              <span className="lbl-tab">Archive</span>
              <p>Select a prior day to play.</p>
            </div>
            <div className="archive-days">
              {archivedDates.map((date) => (
                <button
                  className={date === activeDate ? "active" : ""}
                  key={date}
                  onClick={() => onSelectDate(date)}
                  type="button"
                >
                  {formatPlayDate(date)}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <section className="lb-grid">
          <div className="lb-panel">
            <span className="lbl-tab">Total Points</span>
            <h1 className="tp-num">{totalScore.toLocaleString()}</h1>
            <p className="tp-sub">
              Five sports moments scored for location &amp; year accuracy
            </p>
            <div className="rounds">
              {scoreHistory.map((score, index) => (
                <div
                  className={`rchip ${
                    score.roundScore === bestRoundScore ? "best" : ""
                  }`}
                  key={`round-${index + 1}`}
                >
                  <span>Round {index + 1}</span>
                  <b>{score.roundScore.toLocaleString()}</b>
                </div>
              ))}
            </div>
            <div className="share-block">
              <div className="share-hero">
                <div>
                  <div className="lbl">Shareable Score</div>
                  <div className="date">{displayDate}</div>
                </div>
                <div className="big">{totalScore.toLocaleString()}</div>
              </div>
              <div className="share-btns">
                <button
                  className="btn btn-red"
                  disabled={isCreatingChallenge}
                  onClick={createFriendChallenge}
                  type="button"
                >
                  <SwordsIcon />
                  {isCreatingChallenge ? "Creating..." : "Challenge Friend"}
                </button>
                <button
                  className="btn btn-chrome"
                  onClick={shareDailyScore}
                  type="button"
                >
                  <ShareIcon />
                  Share Score
                </button>
                <button
                  className="btn btn-dark"
                  onClick={() => shareToSocial("x")}
                  type="button"
                >
                  <XIcon />
                  Post on X
                </button>
                <button
                  className="btn btn-dark"
                  onClick={() => shareToSocial("facebook")}
                  type="button"
                >
                  <FacebookIcon />
                  Facebook
                </button>
              </div>
              {shareStatus ? <p className="share-card-status">{shareStatus}</p> : null}
              {challengeUrl ? <p className="share-card-url">{challengeUrl}</p> : null}
            </div>
            <button
              className="play-diff"
              onClick={() => setIsArchiveOpen(true)}
              type="button"
            >
              Play a Different Day
            </button>
          </div>
          <aside className="lb-panel">
            <div className="lb-top">
              <div>
                <span className="lbl-tab">Leaderboard</span>
                <h2 className="lb-title">Today</h2>
              </div>
              <span className="live"><span className="dot" />Live</span>
            </div>
            <div className="standings-head">
              <span>Rank</span>
              <span>Player</span>
              <span className="r">Points</span>
            </div>
            {leaderboard.length ? (
              <ol className="lb-standings">
                {leaderboard.map((entry) => (
                  <li key={`${entry.userId}-${entry.rank}`}>
                    <span className="rank">#{entry.rank}</span>
                    <span className="player">{entry.displayName}</span>
                    <span className="points">{entry.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <>
                <div className="lb-ghost">
                  {[1, 2, 3, 4].map((rank) => (
                    <div className="ghost-row" key={rank}>
                      <span className="rank">{rank}</span>
                      <span className="bar" />
                      <span className="sc" />
                    </div>
                  ))}
                </div>
                <div className="lb-empty">
                  <span className="ico"><LockIcon /></span>
                  <p>Sign in &amp; finish a game to claim your spot on today&apos;s board.</p>
                  <button className="cta" type="button">Sign in to compete</button>
                </div>
              </>
            )}
            {challenge ? (
              <section className="challenge-board">
                <span className="lbl-tab">Challenge</span>
                <h3>Friends</h3>
                {challengeLeaderboard.length ? (
                  <ol className="lb-standings">
                    {challengeLeaderboard.map((entry) => (
                      <li key={`${entry.userId}-${entry.rank}`}>
                        <span className="rank">#{entry.rank}</span>
                        <span className="player">{entry.displayName}</span>
                        <span className="points">{entry.score.toLocaleString()}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="challenge-empty">
                    Challenge scores appear after friends finish.
                  </p>
                )}
              </section>
            ) : null}
          </aside>
        </section>
      </div>
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

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.83l4.713 6.231 5.447-6.231zm-1.16 17.52h1.833L7.084 4.126H5.117l11.967 15.644z"
        fill="currentColor"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.99 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.99 22 12z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function SwordsIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M5 14l-2 2v3h3l2-2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <rect
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        width="16"
        x="4"
        y="10"
      />
      <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
