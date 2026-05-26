export type LocationPoint = {
  lat: number;
  lng: number;
  country?: string;
};

export type RoundLocation = LocationPoint & {
  name: string;
  city: string;
  country: string;
};

export type Round = {
  id: string;
  title: string;
  imageUrl: string;
  initialPanoramaYaw?: number;
  actualYear: number;
  actualMonth: string;
  actualDay: number;
  actualLocation: RoundLocation;
  description: string;
};

export type Guess = {
  year: number | null;
  location: LocationPoint | null;
};

export type ScoreResult = {
  distanceMiles: number;
  yearError: number;
  countryMatch: boolean;
  locationScore: number;
  yearScore: number;
  roundScore: number;
};
