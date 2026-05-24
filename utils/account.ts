"use client";

import type { UserProfile } from "@/types/account";

const PROFILE_KEY = "momentguessr-profile";

export function readProfile() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawProfile = window.localStorage.getItem(PROFILE_KEY);

    return rawProfile ? (JSON.parse(rawProfile) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(displayName: string) {
  const existingProfile = readProfile();
  const profile: UserProfile = {
    createdAt: existingProfile?.createdAt ?? new Date().toISOString(),
    displayName,
    id: existingProfile?.id ?? crypto.randomUUID(),
  };

  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

  return profile;
}

export function clearProfile() {
  window.localStorage.removeItem(PROFILE_KEY);
}
