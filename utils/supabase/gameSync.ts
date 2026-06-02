"use client";

import type { Guess, Round, ScoreResult } from "@/types/game";
import type { DailyScoreHistory } from "@/types/history";
import { createClient } from "@/utils/supabase/client";

export type CompletedRound = {
  guess: Guess;
  result: ScoreResult;
  round: Round;
  timeRemainingSeconds: number;
};

type ProfileInput = {
  displayName?: string | null;
  email?: string | null;
};

export async function getSignedInUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function ensureProfile(input: ProfileInput = {}) {
  const supabase = createClient();
  const user = await getSignedInUser();

  if (!user) {
    return null;
  }

  const displayName =
    input.displayName?.trim() ||
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    input.email?.split("@")[0] ||
    user.email?.split("@")[0] ||
    "Player";

  const { error } = await supabase.from("profiles").upsert({
    avatar_url: user.user_metadata?.avatar_url ?? null,
    display_name: displayName,
    id: user.id,
  });

  if (error) {
    console.error("Failed to sync Supabase profile", error);
  }

  await supabase.from("user_stats").upsert(
    {
      user_id: user.id,
    },
    { onConflict: "user_id" },
  );

  return user;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  await ensureProfile({ email });

  return data.user;
}

export async function signUpWithPassword(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: email.split("@")[0],
      },
    },
  });

  if (error) {
    throw error;
  }

  if (data.user) {
    await ensureProfile({ email });
  }

  return data.user;
}

export async function signInWithOAuth(provider: "apple" | "google") {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    throw error;
  }
}

export async function syncCompletedGame({
  dailyGameId,
  rounds,
  totalScore,
}: {
  dailyGameId: string;
  rounds: CompletedRound[];
  totalScore: number;
}) {
  const supabase = createClient();
  const user = await ensureProfile();

  if (!user || rounds.length === 0) {
    return null;
  }

  const completedAt = new Date().toISOString();
  const { data: gameSession, error: gameError } = await supabase
    .from("game_sessions")
    .insert({
      completed_at: completedAt,
      daily_game_id: dailyGameId,
      game_mode: "daily",
      metadata: {},
      rounds_played: rounds.length,
      total_score: totalScore,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (gameError || !gameSession) {
    console.error("Failed to sync Supabase game session", gameError);
    return null;
  }

  const { error: roundsError } = await supabase.from("round_results").insert(
    rounds.map(({ guess, result, round, timeRemainingSeconds }) => ({
      actual_lat: round.actualLocation.lat,
      actual_lng: round.actualLocation.lng,
      distance_km: result.distanceMiles * 1.609344,
      game_session_id: gameSession.id,
      guessed_lat: guess.location?.lat ?? null,
      guessed_lng: guess.location?.lng ?? null,
      image_url: round.imageUrl,
      metadata: {
        countryMatch: result.countryMatch,
        day: guess.day,
        locationScore: result.locationScore,
        month: guess.month,
        year: guess.year,
        yearError: result.yearError,
        yearScore: result.yearScore,
      },
      points: result.roundScore,
      round_id: round.id,
      round_title: round.title,
      time_remaining_seconds: timeRemainingSeconds,
      timed_out: Boolean(result.timedOut),
      user_id: user.id,
    })),
  );

  if (roundsError) {
    console.error("Failed to sync Supabase round results", roundsError);
  }

  await refreshUserStats(user.id);

  return gameSession.id as string;
}

export async function readSupabaseHistory(): Promise<DailyScoreHistory[]> {
  const supabase = createClient();
  const user = await getSignedInUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("game_sessions")
    .select("daily_game_id, completed_at, started_at, total_score")
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("Failed to read Supabase history", error);
    return [];
  }

  return (data ?? []).map((session) => ({
    date: session.daily_game_id || toDateKey(session.completed_at || session.started_at),
    playedAt: session.completed_at || session.started_at || new Date().toISOString(),
    roundScores: [],
    totalScore: session.total_score ?? 0,
  }));
}

async function refreshUserStats(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_sessions")
    .select("total_score, rounds_played")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  if (error) {
    console.error("Failed to refresh Supabase user stats", error);
    return;
  }

  const sessions = data ?? [];
  const gamesPlayed = sessions.length;
  const roundsPlayed = sessions.reduce(
    (total, session) => total + (session.rounds_played ?? 0),
    0,
  );
  const totalPoints = sessions.reduce(
    (total, session) => total + (session.total_score ?? 0),
    0,
  );
  const bestGameScore = sessions.reduce(
    (best, session) => Math.max(best, session.total_score ?? 0),
    0,
  );

  const { error: statsError } = await supabase.from("user_stats").upsert(
    {
      average_game_score: gamesPlayed ? totalPoints / gamesPlayed : 0,
      best_game_score: bestGameScore,
      games_played: gamesPlayed,
      rounds_played: roundsPlayed,
      total_points: totalPoints,
      user_id: userId,
    },
    { onConflict: "user_id" },
  );

  if (statsError) {
    console.error("Failed to upsert Supabase user stats", statsError);
  }
}

function toDateKey(value: string | null) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
