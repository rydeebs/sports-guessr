import type { LocationPoint } from "@/types/game";

const EARTH_RADIUS_MILES = 3958.7613;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineDistanceMiles(
  firstPoint: LocationPoint,
  secondPoint: LocationPoint,
) {
  const latitudeDelta = toRadians(secondPoint.lat - firstPoint.lat);
  const longitudeDelta = toRadians(secondPoint.lng - firstPoint.lng);
  const firstLatitude = toRadians(firstPoint.lat);
  const secondLatitude = toRadians(secondPoint.lat);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}
