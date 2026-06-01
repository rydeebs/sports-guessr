"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { DailySummary } from "@/components/DailySummary";
import { GuessMap } from "@/components/GuessMap";
import { RoundResultView } from "@/components/RoundResultView";
import { ScoreDisplay } from "@/components/ScoreDisplay";
import { SettingsModal } from "@/components/SettingsModal";
import { Timer } from "@/components/Timer";
import { WelcomePopup } from "@/components/WelcomePopup";
import { YearSlider } from "@/components/YearSlider";
import { getAvailableDailyDates } from "@/data/dailyGames";
import { rounds } from "@/data/rounds";
import type { Guess, ScoreResult } from "@/types/game";
import type { DailyScoreHistory } from "@/types/history";
import { readDailyHistory, writeDailyHistory } from "@/utils/history";
import { scoreGuess } from "@/utils/scoring";

const ROUND_SECONDS = 60;
const blankGuess: Guess = { day: null, month: null, year: null, location: null };
const DAY_COUNT = 6;
const ROUNDS_PER_GAME = 5;
const ACCOUNT_STORAGE_KEY = "momentguessr-account-user";

export default function Home() {
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState<Guess>(blankGuess);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreResult[]>([]);
  const [isDailyComplete, setIsDailyComplete] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAccountUser, setIsAccountUser] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [activeDate, setActiveDate] = useState(getLocalDateKey(new Date()));
  const [dailyHistory, setDailyHistory] = useState<DailyScoreHistory[]>([]);
  const timeoutHandledRef = useRef(false);
  const [gameRounds, setGameRounds] = useState(() =>
    selectRandomRounds(rounds, ROUNDS_PER_GAME),
  );
  const round = gameRounds[roundIndex];

  useEffect(() => {
    setDailyHistory(readDailyHistory());
    const storedAccountState = window.localStorage.getItem(ACCOUNT_STORAGE_KEY);

    if (storedAccountState === "true") {
      setIsAccountUser(true);
      setWelcomeOpen(false);
    }
  }, []);

  useEffect(() => {
    const requestedDate = new URLSearchParams(window.location.search).get("date");

    if (requestedDate && requestedDate !== activeDate) {
      startDay(requestedDate);
    }
  }, [activeDate]);

  useEffect(() => {
    if (result) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [result, roundIndex]);

  const totalScore = useMemo(
    () => scoreHistory.reduce((total, score) => total + score.roundScore, 0),
    [scoreHistory],
  );

  useEffect(() => {
    if (!isDailyComplete || scoreHistory.length !== gameRounds.length) {
      return;
    }

    setDailyHistory(
      writeDailyHistory({
        date: activeDate,
        playedAt: new Date().toISOString(),
        roundScores: scoreHistory.map((score) => score.roundScore),
        totalScore,
      }),
    );
  }, [activeDate, gameRounds.length, isDailyComplete, scoreHistory, totalScore]);

  const canSubmit =
    guess.location !== null &&
    guess.month !== null &&
    guess.day !== null &&
    guess.year !== null &&
    !result;
  const isLastRound = roundIndex === gameRounds.length - 1;

  const submitGuess = () => {
    if (!canSubmit) {
      return;
    }

    timeoutHandledRef.current = true;
    const scoredGuess = scoreGuess(round, guess);
    setResult(scoredGuess);
    setScoreHistory((history) => [...history, scoredGuess]);
  };

  const submitTimeout = () => {
    if (timeoutHandledRef.current) {
      return;
    }

    timeoutHandledRef.current = true;
    const timedOutScore: ScoreResult = {
      countryMatch: false,
      distanceMiles: 0,
      locationScore: 0,
      roundScore: 0,
      timedOut: true,
      yearError: 0,
      yearScore: 0,
    };

    setResult(timedOutScore);
    setScoreHistory((history) => [...history, timedOutScore]);
  };

  const resetRoundState = () => {
    timeoutHandledRef.current = false;
    setGuess(blankGuess);
    setResult(null);
    setSecondsLeft(ROUND_SECONDS);
  };

  const advanceRound = () => {
    if (isLastRound) {
      setIsDailyComplete(true);
      return;
    }

    setRoundIndex((index) => index + 1);
    resetRoundState();
  };

  useEffect(() => {
    if (secondsLeft !== 0 || result) {
      return;
    }

    submitTimeout();
  }, [result, secondsLeft]);

  useEffect(() => {
    if (!result?.timedOut) {
      return;
    }

    const timer = window.setTimeout(() => {
      advanceRound();
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [result, roundIndex]);

  const startDay = (date: string) => {
    setActiveDate(date);
    setGameRounds(selectRandomRounds(rounds, ROUNDS_PER_GAME));
    setIsDailyComplete(false);
    setRoundIndex(0);
    setScoreHistory([]);
    resetRoundState();
  };

  const markAccountUser = () => {
    window.localStorage.setItem(ACCOUNT_STORAGE_KEY, "true");
    setIsAccountUser(true);
    setSettingsOpen(false);
  };

  if (isDailyComplete) {
    return (
      <DailySummary
        activeDate={activeDate}
        archivedDates={getArchiveDates(activeDate)}
        onSelectDate={startDay}
        scoreHistory={scoreHistory}
        totalScore={totalScore}
      />
    );
  }

  if (result) {
    return (
      <RoundResultView
        guessLocation={guess.location}
        isLastRound={isLastRound}
        onNextRound={advanceRound}
        result={result}
        round={round}
      />
    );
  }

  return (
    <GameLayout isDimmed={welcomeOpen} round={round}>
      <header className="game-header pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:gap-4 sm:p-6">
        <div className="game-brand pointer-events-auto">
          <img
            alt="Moment Guessr"
            className="game-brand-logo"
            src="/moment-popup/logo.png"
          />
        </div>
        <div className="game-timer pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 sm:top-6">
          <Timer secondsLeft={secondsLeft} totalSeconds={ROUND_SECONDS} />
        </div>
        <div className="pointer-events-auto">
          <ScoreDisplay
            currentRound={roundIndex + 1}
            totalRounds={gameRounds.length}
            totalScore={totalScore}
          />
        </div>
      </header>

      {isAccountUser ? (
        <div className="game-settings pointer-events-auto absolute bottom-3 left-3 z-20 sm:bottom-6 sm:left-6">
          <button
            className="glass-control rounded-full px-4 py-2.5 font-sans text-xs font-black uppercase text-white shadow-2xl transition sm:px-5 sm:py-3 sm:text-sm"
            onClick={() => setSettingsOpen(true)}
            type="button"
          >
            Settings
          </button>
        </div>
      ) : null}

      <div className="game-submit pointer-events-auto absolute bottom-3 right-3 z-20 sm:bottom-6 sm:right-6">
        <button
          className="glass-control rounded-full px-5 py-2.5 font-sans text-xs font-black uppercase text-white shadow-2xl transition disabled:cursor-not-allowed disabled:opacity-45 sm:px-7 sm:py-3 sm:text-sm"
          disabled={!canSubmit}
          onClick={submitGuess}
          type="button"
        >
          Submit
        </button>
      </div>

      <div className="year-dock pointer-events-auto absolute inset-x-0 bottom-3 z-10 flex justify-center px-4 sm:bottom-6">
        <YearSlider
          day={guess.day}
          disabled={Boolean(result)}
          month={guess.month}
          onChange={(date) => setGuess((current) => ({ ...current, ...date }))}
          year={guess.year}
        />
      </div>

      <div className="map-dock pointer-events-auto absolute bottom-20 right-3 z-20 sm:bottom-28 sm:right-6">
        <GuessMap
          actualLocation={result ? round.actualLocation : undefined}
          disabled={Boolean(result)}
          guess={guess.location}
          onSelect={(location) =>
            setGuess((current) => ({ ...current, location }))
          }
        />
      </div>

      <SettingsModal
        history={dailyHistory}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <WelcomePopup
        isOpen={welcomeOpen}
        isAccountUser={isAccountUser}
        onClose={() => setWelcomeOpen(false)}
        onCreateAccount={markAccountUser}
        onOpen={() => setWelcomeOpen(true)}
      />
    </GameLayout>
  );
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getArchiveDates(activeDate: string) {
  const availableDates = getAvailableDailyDates();

  return availableDates.includes(activeDate)
    ? availableDates.slice(0, DAY_COUNT)
    : [activeDate, ...availableDates].slice(0, DAY_COUNT);
}

function shuffleRounds<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function selectRandomRounds<T>(items: T[], count: number) {
  return shuffleRounds(items).slice(0, count);
}
