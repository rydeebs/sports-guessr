"use client";

import { createClient } from "@/utils/supabase/client";
import { ensureProfile, getSignedInUser } from "@/utils/supabase/gameSync";

export type LeaderboardEntry = {
  avatarUrl: string | null;
  displayName: string;
  rank: number;
  score: number;
  userId: string;
};

export type Challenge = {
  dailyGameId: string;
  id: string;
  title: string;
};

export async function createChallenge(dailyGameId: string) {
  const supabase = createClient();
  const user = await ensureProfile();

  if (!user) {
    throw new Error("Sign in to create a challenge.");
  }

  const { data, error } = await supabase
    .from("challenges")
    .insert({
      creator_user_id: user.id,
      daily_game_id: dailyGameId,
      title: "Daily Challenge",
    })
    .select("id, daily_game_id, title")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to create challenge.");
  }

  return {
    dailyGameId: data.daily_game_id,
    id: data.id,
    title: data.title,
  } satisfies Challenge;
}

export async function readChallenge(challengeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("id, daily_game_id, title")
    .eq("id", challengeId)
    .maybeSingle();

  if (error) {
    console.error("Failed to read challenge", error);
    return null;
  }

  return data
    ? ({
        dailyGameId: data.daily_game_id,
        id: data.id,
        title: data.title,
      } satisfies Challenge)
    : null;
}

export async function readDailyLeaderboard(dailyGameId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("game_sessions")
    .select("user_id, total_score, completed_at, profiles(display_name, avatar_url)")
    .eq("daily_game_id", dailyGameId)
    .not("completed_at", "is", null)
    .order("total_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Failed to read daily leaderboard", error);
    return [];
  }

  return normalizeLeaderboardRows(
    (data ?? []).map((entry) => ({
      avatar_url: getJoinedProfile(entry.profiles)?.avatar_url ?? null,
      display_name: getJoinedProfile(entry.profiles)?.display_name ?? null,
      score: entry.total_score ?? 0,
      user_id: entry.user_id,
    })),
  );
}

export async function readChallengeLeaderboard(challengeId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("challenge_entries")
    .select("user_id, total_score, completed_at, profiles(display_name, avatar_url)")
    .eq("challenge_id", challengeId)
    .order("total_score", { ascending: false })
    .order("completed_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("Failed to read challenge leaderboard", error);
    return [];
  }

  return normalizeLeaderboardRows(
    (data ?? []).map((entry) => ({
      avatar_url: getJoinedProfile(entry.profiles)?.avatar_url ?? null,
      display_name: getJoinedProfile(entry.profiles)?.display_name ?? null,
      score: entry.total_score ?? 0,
      user_id: entry.user_id,
    })),
  );
}

export async function readGlobalLeaderboard() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("user_id, display_name, avatar_url, total_points")
    .order("total_points", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to read global leaderboard", error);
    return [];
  }

  return normalizeLeaderboardRows(
    (data ?? []).map((entry) => ({
      avatar_url: entry.avatar_url,
      display_name: entry.display_name,
      score: entry.total_points ?? 0,
      user_id: entry.user_id,
    })),
  );
}

export async function getShareUrl(pathAndQuery = "/") {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://momentguessr.com";

  return `${origin}${pathAndQuery}`;
}

export async function shareText({
  text,
  title,
  url,
}: {
  text: string;
  title: string;
  url: string;
}) {
  if (navigator.share) {
    await navigator.share({ text, title, url });
    return "shared";
  }

  await navigator.clipboard.writeText(`${text} ${url}`);
  return "copied";
}

export function openSocialShare(
  network: "facebook" | "x",
  { text, url }: { text: string; url: string },
) {
  const shareUrl =
    network === "x"
      ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text,
        )}&url=${encodeURIComponent(url)}`
      : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

export async function getCurrentUserId() {
  return (await getSignedInUser())?.id ?? null;
}

function normalizeLeaderboardRows(
  rows: {
    avatar_url: string | null;
    display_name: string | null;
    score: number;
    user_id: string;
  }[],
) {
  return rows.map((row, index) => ({
    avatarUrl: row.avatar_url,
    displayName: row.display_name || "Player",
    rank: index + 1,
    score: row.score,
    userId: row.user_id,
  }));
}

function getJoinedProfile(
  profile: { avatar_url: string | null; display_name: string | null } | {
    avatar_url: string | null;
    display_name: string | null;
  }[] | null,
) {
  return Array.isArray(profile) ? profile[0] : profile;
}
