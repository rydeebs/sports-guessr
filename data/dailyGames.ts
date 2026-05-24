import { rounds } from "@/data/rounds";
import type { DailyGame, DailyGameDefinition } from "@/types/daily";

export const dailyGameDefinitions: DailyGameDefinition[] = [
  {
    date: "2026-05-23",
    roundIds: [
      "1936-olympics-jesse-owens",
      "barry-bonds-home-run-record",
      "michael-jordan-last-shot",
      "maradona-hand-of-god",
      "tiger-woods-chip-in-2005",
    ],
  },
  {
    date: "2026-05-22",
    roundIds: [
      "tiger-woods-chip-in-2005",
      "maradona-hand-of-god",
      "michael-jordan-last-shot",
      "barry-bonds-home-run-record",
      "1936-olympics-jesse-owens",
    ],
  },
  {
    date: "2026-05-21",
    roundIds: [
      "barry-bonds-home-run-record",
      "1936-olympics-jesse-owens",
      "tiger-woods-chip-in-2005",
      "michael-jordan-last-shot",
      "maradona-hand-of-god",
    ],
  },
  {
    date: "2026-05-20",
    roundIds: [
      "michael-jordan-last-shot",
      "tiger-woods-chip-in-2005",
      "1936-olympics-jesse-owens",
      "maradona-hand-of-god",
      "barry-bonds-home-run-record",
    ],
  },
];

export function getDailyGame(date: string): DailyGame {
  const definition =
    dailyGameDefinitions.find((game) => game.date === date) ??
    dailyGameDefinitions[0];
  const dailyRounds = definition.roundIds
    .map((roundId) => rounds.find((round) => round.id === roundId))
    .filter((round): round is (typeof rounds)[number] => Boolean(round));

  return {
    date: definition.date,
    hasUniqueImages: hasUniqueRoundImages(dailyRounds),
    rounds: dailyRounds,
  };
}

export function getAvailableDailyDates() {
  return dailyGameDefinitions.map((game) => game.date);
}

export function hasUniqueRoundImages(dailyRounds: typeof rounds) {
  const imageUrls = dailyRounds.map((round) => round.imageUrl);

  return new Set(imageUrls).size === imageUrls.length;
}
