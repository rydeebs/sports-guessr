"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { UserProfile } from "@/types/account";
import type { DailyScoreHistory } from "@/types/history";
import { clearProfile, readProfile, saveProfile } from "@/utils/account";
import { readDailyHistory } from "@/utils/history";
import { createClient } from "@/utils/supabase/client";

export default function AccountPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [history, setHistory] = useState<DailyScoreHistory[]>([]);
  const [stats, setStats] = useState<{
    bestGameScore: number;
    gamesPlayed: number;
    totalPoints: number;
  } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const savedProfile = readProfile();
    setProfile(savedProfile);
    setDisplayName(savedProfile?.displayName ?? "");
    setHistory(readDailyHistory());

    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) {
          return;
        }

        setUserId(data.user.id);

        const [{ data: profileData }, { data: statsData }, { data: sessions }] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("display_name")
              .eq("id", data.user.id)
              .maybeSingle(),
            supabase
              .from("user_stats")
              .select("best_game_score, games_played, total_points")
              .eq("user_id", data.user.id)
              .maybeSingle(),
            supabase
              .from("game_sessions")
              .select("daily_game_id, completed_at, started_at, total_score")
              .eq("user_id", data.user.id)
              .not("completed_at", "is", null)
              .order("completed_at", { ascending: false })
              .limit(30),
          ]);

        if (profileData?.display_name) {
          const supabaseProfile = saveProfile(profileData.display_name);
          setProfile(supabaseProfile);
          setDisplayName(profileData.display_name);
        }

        if (statsData) {
          setStats({
            bestGameScore: statsData.best_game_score ?? 0,
            gamesPlayed: statsData.games_played ?? 0,
            totalPoints: statsData.total_points ?? 0,
          });
        }

        if (sessions?.length) {
          setHistory(
            sessions.map((session) => ({
              date:
                session.daily_game_id ||
                toDateKey(session.completed_at || session.started_at),
              playedAt:
                session.completed_at ||
                session.started_at ||
                new Date().toISOString(),
              roundScores: [],
              totalScore: session.total_score ?? 0,
            })),
          );
        }
      })
      .catch((error) => {
        console.error("Failed to load Supabase account", error);
      });
  }, []);

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      return;
    }

    setProfile(saveProfile(trimmedName));

    if (userId) {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmedName })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update Supabase profile", error);
      }
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearProfile();
    setProfile(null);
    setDisplayName("");
    setStats(null);
    setUserId(null);
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
      {stats ? (
        <section className="state-card mx-auto mt-4 grid max-w-3xl gap-3 rounded-[1.5rem] p-6 font-sans sm:grid-cols-3">
          <Stat label="Games" value={stats.gamesPlayed.toLocaleString()} />
          <Stat label="Total Points" value={stats.totalPoints.toLocaleString()} />
          <Stat label="Best Game" value={stats.bestGameScore.toLocaleString()} />
        </section>
      ) : null}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-[#d3dde8] bg-white px-4 py-3">
      <p className="text-xs font-black uppercase text-[#566373]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function toDateKey(value: string | null) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
