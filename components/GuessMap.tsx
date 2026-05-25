"use client";

import { useEffect, useRef, useState } from "react";
import type { LocationPoint } from "@/types/game";
import { getGoogleMapsErrorMessage, loadGoogleMaps } from "@/utils/googleMaps";

type GuessMapProps = {
  guess: LocationPoint | null;
  actualLocation?: LocationPoint;
  onSelect: (point: LocationPoint) => void;
  disabled?: boolean;
};

export function GuessMap({
  guess,
  actualLocation,
  onSelect,
  disabled = false,
}: GuessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const guessMarkerRef = useRef<google.maps.Marker | null>(null);
  const actualMarkerRef = useRef<google.maps.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const disabledRef = useRef(disabled);
  const isExpandedRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [mapError, setMapError] = useState(
    "Google Maps failed to load. Check API key, billing, and referrers",
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    isExpandedRef.current = isExpanded;
  }, [isExpanded]);

  useEffect(() => {
    const collapseOnOutsideTap = (event: PointerEvent) => {
      if (
        !isExpandedRef.current ||
        !isTouchViewport() ||
        !mapRef.current ||
        mapRef.current.parentElement?.contains(event.target as Node)
      ) {
        return;
      }

      setIsExpanded(false);
    };

    document.addEventListener("pointerdown", collapseOnOutsideTap);

    return () => {
      document.removeEventListener("pointerdown", collapseOnOutsideTap);
    };
  }, []);

  const selectLocation = (point: LocationPoint) => {
    geocoderRef.current
      ?.geocode({ location: point })
      .then(({ results }) => {
        onSelectRef.current({
          ...point,
          country: getCountryFromGeocodeResults(results),
        });
      })
      .catch(() => {
        onSelectRef.current(point);
      });
  };

  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then(({ Geocoder, Map }) => {
        if (!isMounted || !mapRef.current || googleMapRef.current) {
          return;
        }

        const map = new Map(mapRef.current, {
          center: { lat: 18, lng: 0 },
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          mapTypeControl: false,
          minZoom: 1,
          restriction: {
            latLngBounds: {
              north: 85,
              south: -85,
              east: 180,
              west: -180,
            },
          },
          streetViewControl: false,
          zoom: 1,
          zoomControl: true,
        });

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (disabledRef.current || !event.latLng) {
            return;
          }

          if (isTouchViewport() && !isExpandedRef.current) {
            setIsExpanded(true);
            return;
          }

          const point = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          selectLocation(point);
        });

        map.addListener("rightclick", (event: google.maps.MapMouseEvent) => {
          if (disabledRef.current || !event.latLng) {
            return;
          }

          onSelectRef.current({
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          });
        });

        geocoderRef.current = new Geocoder();
        googleMapRef.current = map;
        setMapStatus("ready");
      })
      .catch((error) => {
        if (isMounted) {
          console.error("Google Maps failed to initialize", error);
          setMapError(getGoogleMapsErrorMessage(error));
          setMapStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const map = googleMapRef.current;

    if (!map || !window.google?.maps) {
      return;
    }

    guessMarkerRef.current?.setMap(null);
    guessMarkerRef.current = guess
      ? new google.maps.Marker({ map, position: guess, title: "Your guess" })
      : null;
  }, [guess]);

  useEffect(() => {
    const map = googleMapRef.current;

    if (!map || !window.google?.maps) {
      return;
    }

    actualMarkerRef.current?.setMap(null);
    actualMarkerRef.current = actualLocation
      ? new google.maps.Marker({
          icon: {
            fillColor: "#18a56f",
            fillOpacity: 1,
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            strokeColor: "#fff7e8",
            strokeWeight: 3,
          },
          map,
          position: actualLocation,
          title: "Actual location",
        })
      : null;
  }, [actualLocation]);

  useEffect(() => {
    window.setTimeout(() => {
      if (googleMapRef.current && window.google?.maps) {
        google.maps.event.trigger(googleMapRef.current, "resize");
      }
    }, 320);
  }, [isExpanded]);

  return (
    <section
      className={`glass-panel group relative rounded-[1.75rem] p-2 text-[#0d1a26] shadow-2xl transition-all duration-300 ${
        isExpanded ? "map-expanded" : "map-preview"
      }`}
      onClick={() => {
        if (!disabled && isTouchViewport() && !isExpandedRef.current) {
          setIsExpanded(true);
        }
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        aria-label="World map guess selector"
        className={`world-map relative overflow-hidden rounded-[1.1rem] ${
          disabled ? "cursor-default" : "cursor-crosshair"
        }`}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsExpanded(true);
          }
        }}
        ref={mapRef}
        role="button"
        tabIndex={0}
      />
      {mapStatus !== "ready" ? (
        <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-[1.1rem] bg-[#08131f]/92 p-4 text-center font-sans text-xs font-bold uppercase text-white">
          {mapStatus === "loading"
            ? "Loading Google Maps"
            : mapError}
        </div>
      ) : null}
    </section>
  );
}

function isTouchViewport() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(hover: none)").matches || window.innerWidth <= 640)
  );
}

function getCountryFromGeocodeResults(results: google.maps.GeocoderResult[]) {
  for (const result of results) {
    const countryComponent = result.address_components.find((component) =>
      component.types.includes("country"),
    );

    if (countryComponent) {
      return countryComponent.long_name;
    }
  }

  return undefined;
}
