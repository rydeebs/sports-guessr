"use client";

import Link from "next/link";
import type { DailyScoreHistory } from "@/types/history";

type SettingsModalProps = {
  history: DailyScoreHistory[];
  isOpen: boolean;
  onClose: () => void;
};

export function SettingsModal({
  history,
  isOpen,
  onClose,
}: SettingsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-[#06101c]/62 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <section className="settings-sheet glass-panel w-full max-w-md rounded-[1.75rem] p-5 text-[#0d1a26] shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-4xl leading-none">Settings</h2>
          <button
            aria-label="Close settings"
            className="grid size-10 place-items-center rounded-full border border-[#aab7c5] font-sans text-xl text-[#0d1a26] transition hover:bg-[#e3eaf2]"
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <button
          className="settings-pill mt-5 w-full"
          onClick={onClose}
          type="button"
        >
          Start Game
        </button>
        <div className="mt-4">
          <p className="font-serif text-2xl font-semibold text-[#566373]">
            Game Mode
          </p>
          <div className="mt-2 grid gap-2">
            <button className="settings-pill settings-pill-active" type="button">
              Single Player
            </button>
            <button className="settings-pill" type="button">
              Multiplayer
            </button>
          </div>
        </div>
        <section className="profile-history mt-4 rounded-[1.2rem] border border-[#c3cfdb] bg-[#f5f8fb] p-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-sans text-[0.65rem] font-black uppercase text-[#566373]">
                Profile
              </p>
              <h3 className="font-serif text-2xl">Score History</h3>
            </div>
            <span className="font-sans text-xs font-bold text-[#566373]">
              {history.length} days
            </span>
          </div>
          <div className="mt-3 grid gap-1.5">
            {history.length ? (
              history.slice(0, 4).map((entry) => (
                <div
                  className="flex items-center justify-between rounded-[0.9rem] bg-white px-3 py-2 font-sans shadow-sm"
                  key={entry.date}
                >
                  <span className="text-xs font-bold text-[#566373]">
                    {formatScoreDate(entry.date)}
                  </span>
                  <span className="text-sm font-black">
                    {entry.totalScore.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-[0.9rem] bg-white px-3 py-2 font-sans text-xs font-semibold text-[#566373] shadow-sm">
                Finish a daily game to save a score here.
              </p>
            )}
          </div>
        </section>
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 font-sans text-xs font-bold text-[#566373]">
          <span>v 1.0</span>
          <div className="flex flex-wrap items-center gap-4">
            <button className="settings-link" type="button">
              help
            </button>
            <Link className="settings-link" href="/account" onClick={onClose}>
              profile
            </Link>
            <Link className="settings-link" href="/archive" onClick={onClose}>
              archive
            </Link>
            <Link className="settings-link" href="/multiplayer" onClick={onClose}>
              multiplayer
            </Link>
            <Link
              aria-label="Open stats"
              className="settings-globe"
              href="/state"
              onClick={onClose}
            >
              <GlobeIcon />
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
}

function formatScoreDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
