"use client";

const GOOGLE_MAPS_SCRIPT_ID = "momentguessr-google-maps";
const GOOGLE_MAPS_CALLBACK = "__momentGuessrGoogleMapsReady";
const BUILD_TIME_GOOGLE_MAPS_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let googleMapsScriptLoader: Promise<void> | null = null;
let googleMapsLibrariesLoader: Promise<GoogleMapsLibraries> | null = null;
let googleMapsAuthFailed = false;
let runtimeGoogleMapsKey: string | null = BUILD_TIME_GOOGLE_MAPS_KEY || null;

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __momentGuessrGoogleMapsReady?: () => void;
  }
}

export type GoogleMapsLibraries = {
  Geocoder: typeof google.maps.Geocoder;
  LatLngBounds: typeof google.maps.LatLngBounds;
  Map: typeof google.maps.Map;
  Marker: typeof google.maps.Marker;
  Polyline: typeof google.maps.Polyline;
  SymbolPath: typeof google.maps.SymbolPath;
  event: typeof google.maps.event;
};

export async function loadGoogleMaps(): Promise<GoogleMapsLibraries> {
  if (typeof window === "undefined") {
    throw new Error("Google Maps can only load in the browser.");
  }

  await loadGoogleMapsScript();

  if (!googleMapsLibrariesLoader) {
    googleMapsLibrariesLoader = loadGoogleMapsLibraries();
  }

  return googleMapsLibrariesLoader;
}

async function loadGoogleMapsScript() {
  const googleMapsKey = await getGoogleMapsKey();

  if (!googleMapsKey) {
    throw new Error("Missing Google Maps API key.");
  }

  if (googleMapsAuthFailed) {
    throw new Error("Google Maps API key authentication failed.");
  }

  if (hasGoogleMapsImportLibrary()) {
    return;
  }

  if (!googleMapsScriptLoader) {
    googleMapsScriptLoader = new Promise((resolve, reject) => {
      window.gm_authFailure = () => {
        googleMapsAuthFailed = true;
        reject(new Error("Google Maps key rejected. Check referrer restrictions."));
      };
      window[GOOGLE_MAPS_CALLBACK] = () => resolve();

      const existingScript = document.getElementById(
        GOOGLE_MAPS_SCRIPT_ID,
      ) as HTMLScriptElement | null;

      if (existingScript) {
        if (hasGoogleMapsImportLibrary()) {
          resolve();
        }
        existingScript.addEventListener("error", () =>
          reject(new Error("Google Maps failed to load.")),
        );
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        googleMapsKey,
      )}&v=weekly&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }

  return googleMapsScriptLoader;
}

function hasGoogleMapsImportLibrary() {
  return Boolean(
    (
      window as Window & {
        google?: { maps?: { importLibrary?: unknown } };
      }
    ).google?.maps?.importLibrary,
  );
}

async function loadGoogleMapsLibraries(): Promise<GoogleMapsLibraries> {
  await google.maps.importLibrary("maps");
  await google.maps.importLibrary("marker");

  if (typeof google.maps.Map !== "function") {
    throw new Error("Google Maps loaded without Map constructor.");
  }

  return {
    Geocoder: google.maps.Geocoder,
    LatLngBounds: google.maps.LatLngBounds,
    Map: google.maps.Map,
    Marker: google.maps.Marker,
    Polyline: google.maps.Polyline,
    SymbolPath: google.maps.SymbolPath,
    event: google.maps.event,
  };
}

async function getGoogleMapsKey() {
  if (runtimeGoogleMapsKey) {
    return runtimeGoogleMapsKey;
  }

  const response = await fetch("/api/google-maps-key", {
    cache: "no-store",
  });

  if (!response.ok) {
    return "";
  }

  const config = (await response.json()) as { key?: string };
  runtimeGoogleMapsKey = config.key?.trim() || "";

  return runtimeGoogleMapsKey;
}

export function getGoogleMapsErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Google Maps failed to load.";

  if (message.includes("Missing")) {
    return "Add GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel";
  }

  if (message.includes("rejected") || message.includes("authentication")) {
    return "Google Maps key rejected. Add this Vercel URL to Google referrers";
  }

  return "Google Maps failed to load. Check API key, billing, and referrers";
}
