import type { Guess, Round, ScoreResult } from "@/types/game";
import { haversineDistanceMiles } from "@/utils/haversine";

const MAX_LOCATION_SCORE = 500;
const MAX_YEAR_SCORE = 500;
const COUNTRY_MATCH_BASE_SCORE = 250;
const LOCATION_DISTANCE_FALLOFF_MILES = 10;
const YEAR_SCORE_WINDOW = 20;
const YEAR_SCORE_FALLOFF_RANGE = YEAR_SCORE_WINDOW + 1;

export function scoreGuess(round: Round, guess: Guess): ScoreResult {
  if (guess.year === null || guess.location === null) {
    throw new Error("A year and map point are required before scoring.");
  }

  const distanceMiles = haversineDistanceMiles(
    guess.location,
    round.actualLocation,
  );
  const yearError = Math.abs(round.actualYear - guess.year);
  const countryMatch = isSameCountry(
    guess.location.country,
    round.actualLocation.country,
  );
  const distanceScore = Math.max(
    0,
    Math.round(MAX_LOCATION_SCORE - distanceMiles * LOCATION_DISTANCE_FALLOFF_MILES),
  );
  const locationScore = countryMatch
    ? Math.max(COUNTRY_MATCH_BASE_SCORE, distanceScore)
    : distanceScore;
  const yearScore = Math.max(
    0,
    yearError <= YEAR_SCORE_WINDOW
      ? Math.round(MAX_YEAR_SCORE * (1 - yearError / YEAR_SCORE_FALLOFF_RANGE))
      : 0,
  );

  return {
    distanceMiles,
    yearError,
    countryMatch,
    locationScore,
    yearScore,
    roundScore: locationScore + yearScore,
  };
}

function isSameCountry(guessedCountry: string | undefined, actualCountry: string) {
  if (!guessedCountry) {
    return false;
  }

  return normalizeCountry(guessedCountry) === normalizeCountry(actualCountry);
}

function normalizeCountry(country: string) {
  return country
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
}
