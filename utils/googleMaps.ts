"use client";

const GOOGLE_MAPS_SCRIPT_ID = "momentguessr-google-maps";
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

let googleMapsLoader: Promise<void> | null = null;
let googleMapsAuthFailed = false;

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_KEY);

export function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.google?.maps) {
    return Promise.resolve();
  }

  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error("Missing Google Maps API key."));
  }

  if (googleMapsAuthFailed) {
    return Promise.reject(
      new Error("Google Maps API key authentication failed."),
    );
  }

  if (!googleMapsLoader) {
    googleMapsLoader = new Promise((resolve, reject) => {
      window.gm_authFailure = () => {
        googleMapsAuthFailed = true;
        reject(new Error("Google Maps API key authentication failed."));
      };

      const existingScript = document.getElementById(
        GOOGLE_MAPS_SCRIPT_ID,
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", () =>
          reject(new Error("Google Maps failed to load.")),
        );
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&v=weekly&loading=async`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }

  return googleMapsLoader;
}
