import type { Guess, Round, ScoreResult } from "@/types/game";
import { haversineDistanceMiles } from "@/utils/haversine";

export function scoreGuess(round: Round, guess: Guess): ScoreResult {
  if (guess.year === null || guess.location === null) {
    throw new Error("A year and map point are required before scoring.");
  }

  const distanceMiles = haversineDistanceMiles(
    guess.location,
    round.actualLocation,
  );
  const yearError = Math.abs(round.actualYear - guess.year);
  const locationScore = Math.max(0, Math.round(500 - distanceMiles * 3.3333));
  const yearScore = Math.max(0, 500 - yearError * 25);

  return {
    distanceMiles,
    yearError,
    locationScore,
    yearScore,
    roundScore: locationScore + yearScore,
  };
}
