"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { UserProfile } from "@/types/account";
import type { DailyScoreHistory } from "@/types/history";
import { clearProfile, readProfile, saveProfile } from "@/utils/account";
import { readDailyHistory } from "@/utils/history";

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [history, setHistory] = useState<DailyScoreHistory[]>([]);

  useEffect(() => {
    const savedProfile = readProfile();
    setProfile(savedProfile);
    setDisplayName(savedProfile?.displayName ?? "");
    setHistory(readDailyHistory());
  }, []);

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      return;
    }

    setProfile(saveProfile(trimmedName));
  };

  const signOut = () => {
    clearProfile();
    setProfile(null);
    setDisplayName("");
  };

  return (
    <main className="state-page min-h-screen px-4 py-6 text-[#0d1a26] sm:px-6">
      <section className="state-card mx-auto max-w-3xl rounded-[1.5rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-black uppercase text-[#566373]">
              Account
            </p>
            <h1 className="mt-1 font-serif text-5xl">Player Profile</h1>
          </div>
          <Link className="state-back rounded-full px-5 py-3 font-sans text-sm font-black uppercase" href="/">
            Back
          </Link>
        </div>
        <form className="mt-6 grid gap-3" onSubmit={submitProfile}>
          <label className="font-sans text-xs font-black uppercase text-[#566373]" htmlFor="display-name">
            Display name
          </label>
          <input
            className="rounded-[1rem] border border-[#bfccda] bg-white px-4 py-3 font-sans text-lg outline-none focus:border-[#27323f]"
            id="display-name"
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Enter a player name"
            value={displayName}
          />
          <div className="flex flex-wrap gap-2">
            <button className="sport-action rounded-full px-5 py-3 font-sans text-sm font-black uppercase text-white" type="submit">
              {profile ? "Update Account" : "Create Account"}
            </button>
            {profile ? (
              <button
                className="rounded-full border border-[#bfccda] px-5 py-3 font-sans text-sm font-black uppercase"
                onClick={signOut}
                type="button"
              >
                Sign Out
              </button>
            ) : null}
          </div>
        </form>
      </section>
      <section className="state-card mx-auto mt-4 max-w-3xl rounded-[1.5rem] p-6">
        <p className="font-sans text-xs font-black uppercase text-[#566373]">
          Historic Scores
        </p>
        <div className="mt-4 grid gap-2">
          {history.length ? (
            history.map((entry) => (
              <div
                className="grid grid-cols-[1fr_auto] rounded-[1rem] border border-[#d3dde8] bg-white px-4 py-3 font-sans"
                key={entry.date}
              >
                <span>{formatDate(entry.date)}</span>
                <strong>{entry.totalScore.toLocaleString()}</strong>
              </div>
            ))
          ) : (
            <p className="font-sans text-sm text-[#566373]">
              Play a full daily game to record account history.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
