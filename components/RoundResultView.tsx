"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationPoint, Round, ScoreResult } from "@/types/game";
import { ResultPanel } from "@/components/ResultPanel";
import { getGoogleMapsErrorMessage, loadGoogleMaps } from "@/utils/googleMaps";

type RoundResultViewProps = {
  guessLocation: LocationPoint;
  isLastRound: boolean;
  onNextRound: () => void;
  result: ScoreResult;
  round: Round;
};

export function RoundResultView({
  guessLocation,
  isLastRound,
  onNextRound,
  result,
  round,
}: RoundResultViewProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mapError, setMapError] = useState(
    "Google Maps failed to load. Check API key, billing, and referrers",
  );

  useEffect(() => {
    let isMounted = true;
    let guessMarker: google.maps.Marker | null = null;
    let answerMarker: google.maps.Marker | null = null;
    let connector: google.maps.Polyline | null = null;

    loadGoogleMaps()
      .then(() => {
        if (!isMounted || !mapElementRef.current) {
          return;
        }

        const map = new google.maps.Map(mapElementRef.current, {
          clickableIcons: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
        });
        const actualPoint = {
          lat: round.actualLocation.lat,
          lng: round.actualLocation.lng,
        };

        guessMarker = new google.maps.Marker({
          map,
          position: guessLocation,
          title: "Your guess",
        });
        answerMarker = new google.maps.Marker({
          icon: {
            fillColor: "#246bff",
            fillOpacity: 1,
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            strokeColor: "#fff7e8",
            strokeWeight: 3,
          },
          map,
          position: actualPoint,
          title: round.actualLocation.name,
        });
        connector = new google.maps.Polyline({
          geodesic: true,
          map,
          path: [guessLocation, actualPoint],
          strokeColor: "#0d1a26",
          strokeOpacity: 0.92,
          strokeWeight: 3,
        });

        const bounds = new google.maps.LatLngBounds();
        bounds.extend(guessLocation);
        bounds.extend(actualPoint);

        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.setCenter(actualPoint);
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, {
            bottom: 96,
            left: 96,
            right: window.innerWidth >= 900 ? 600 : 96,
            top: 96,
          });
        }

        setMapStatus("ready");
      })
      .catch((error) => {
        if (isMounted) {
          setMapError(getGoogleMapsErrorMessage(error));
          setMapStatus("error");
        }
      });

    return () => {
      isMounted = false;
      guessMarker?.setMap(null);
      answerMarker?.setMap(null);
      connector?.setMap(null);
    };
  }, [guessLocation, round]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#d9e3f7] text-[#0d1a26]">
      <div
        aria-label="Result map showing guess and answer"
        className="absolute inset-0"
        ref={mapElementRef}
      />
      {mapStatus !== "ready" ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#08131f]/85 p-6 text-center font-sans text-sm font-black uppercase text-white">
          {mapStatus === "loading"
            ? "Loading result map"
            : mapError}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-6">
        <div className="pointer-events-auto glass-dark inline-block rounded-[1.25rem] px-3 py-2 font-serif text-lg text-white shadow-2xl sm:rounded-[1.5rem] sm:px-4 sm:py-3 sm:text-2xl">
          Guess that Play
        </div>
      </div>
      <div className="round-result-panel-wrap pointer-events-none absolute inset-y-0 right-0 z-20 flex w-full items-center justify-end p-3 sm:p-6">
        <div className="pointer-events-auto">
          <ResultPanel
            isLastRound={isLastRound}
            onNextRound={onNextRound}
            result={result}
            round={round}
          />
        </div>
      </div>
    </main>
  );
}
