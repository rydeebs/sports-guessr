"use client";

const GOOGLE_MAPS_SCRIPT_ID = "momentguessr-google-maps";
const BUILD_TIME_GOOGLE_MAPS_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let googleMapsLoader: Promise<void> | null = null;
let googleMapsAuthFailed = false;
let runtimeGoogleMapsKey: string | null = BUILD_TIME_GOOGLE_MAPS_KEY || null;

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export async function loadGoogleMaps() {
  if (typeof window === "undefined") {
    return;
  }

  if (window.google?.maps) {
    return;
  }

  const googleMapsKey = await getGoogleMapsKey();

  if (!googleMapsKey) {
    throw new Error("Missing Google Maps API key.");
  }

  if (googleMapsAuthFailed) {
    throw new Error("Google Maps API key authentication failed.");
  }

  if (!googleMapsLoader) {
    googleMapsLoader = new Promise((resolve, reject) => {
      window.gm_authFailure = () => {
        googleMapsAuthFailed = true;
        reject(new Error("Google Maps key rejected. Check referrer restrictions."));
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        googleMapsKey,
      )}&v=weekly&loading=async`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }

  return googleMapsLoader;
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
