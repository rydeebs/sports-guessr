import type { Round } from "@/types/game";

export type DailyGameDefinition = {
  date: string;
  roundIds: string[];
};

export type DailyGame = {
  date: string;
  rounds: Round[];
  hasUniqueImages: boolean;
};
