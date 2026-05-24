"use client";

import Link from "next/link";
import { useState } from "react";

export default function MultiplayerPage() {
  const [roomCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());

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
            Room Code
          </p>
          <p className="mt-2 font-serif text-6xl">{roomCode}</p>
          <p className="mt-3 font-sans text-sm text-[#566373]">
            This is the front-end lobby shell. Real-time joins, synchronized round
            timers, and score broadcasting require a backend realtime service.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <button className="sport-action rounded-full px-5 py-3 font-sans text-sm font-black uppercase text-white" type="button">
            Create Match
          </button>
          <button className="rounded-full border border-[#bfccda] bg-white px-5 py-3 font-sans text-sm font-black uppercase" type="button">
            Join Match
          </button>
        </div>
      </section>
    </main>
  );
}
