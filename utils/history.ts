import type { DailyScoreHistory } from "@/types/history";

export const DAILY_HISTORY_KEY = "momentguessr-daily-history";

export function readDailyHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawHistory = window.localStorage.getItem(DAILY_HISTORY_KEY);

    if (!rawHistory) {
      return [];
    }

    return JSON.parse(rawHistory) as DailyScoreHistory[];
  } catch {
    return [];
  }
}

export function writeDailyHistory(entry: DailyScoreHistory) {
  const history = readDailyHistory();
  const nextHistory = [
    entry,
    ...history.filter((score) => score.date !== entry.date),
  ].slice(0, 30);

  window.localStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(nextHistory));

  return nextHistory;
}
