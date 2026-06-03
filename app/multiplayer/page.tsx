"use client";

import Link from "next/link";
import { useState } from "react";
import {
  createChallenge,
  getShareUrl,
  shareText,
} from "@/utils/supabase/challenges";

export default function MultiplayerPage() {
  const [challengeUrl, setChallengeUrl] = useState("");
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createDailyChallenge = async () => {
    setStatus("");
    setIsCreating(true);

    try {
      const today = getLocalDateKey(new Date());
      const challenge = await createChallenge(today);
      const url = await getShareUrl(
        `/?challenge=${encodeURIComponent(challenge.id)}`,
      );
      setChallengeUrl(url);
      const shareStatus = await shareText({
        text: "Can you beat my MomentGuessr daily challenge?",
        title: "MomentGuessr Challenge",
        url,
      });

      setStatus(shareStatus === "shared" ? "Challenge shared" : "Challenge copied");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Could not create challenge",
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="state-page min-h-screen px-4 py-6 text-[#0d1a26] sm:px-6">
      <section className="state-card mx-auto max-w-3xl rounded-[1.5rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-sans text-xs font-black uppercase text-[#566373]">
              Multiplayer
            </p>
            <h1 className="mt-1 font-serif text-5xl">Private Match</h1>
          </div>
          <Link className="state-back rounded-full px-5 py-3 font-sans text-sm font-black uppercase" href="/">
            Back
          </Link>
        </div>
        <div className="mt-8 rounded-[1.25rem] border border-[#bfccda] bg-white p-5">
          <p className="font-sans text-xs font-black uppercase text-[#566373]">
            Friend Challenge
          </p>
          <p className="mt-2 font-serif text-4xl">Daily Link</p>
          <p className="mt-3 font-sans text-sm text-[#566373]">
            Create a private daily challenge link. Friends play the same daily
            game and scores appear on the challenge leaderboard after they finish.
          </p>
          {challengeUrl ? (
            <p className="mt-4 break-all rounded-[0.9rem] bg-[#edf3f8] px-3 py-2 font-sans text-xs font-bold text-[#27323f]">
              {challengeUrl}
            </p>
          ) : null}
          {status ? (
            <p className="mt-3 font-sans text-xs font-black uppercase text-[#246bff]">
              {status}
            </p>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button
            className="sport-action rounded-full px-5 py-3 font-sans text-sm font-black uppercase text-white disabled:opacity-55"
            disabled={isCreating}
            onClick={createDailyChallenge}
            type="button"
          >
            {isCreating ? "Creating..." : "Create Challenge"}
          </button>
          <Link
            className="rounded-full border border-[#bfccda] bg-white px-5 py-3 text-center font-sans text-sm font-black uppercase"
            href="/"
          >
            Play Daily
          </Link>
        </div>
      </section>
    </main>
  );
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
