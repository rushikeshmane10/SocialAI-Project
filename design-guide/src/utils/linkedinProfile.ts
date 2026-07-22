import type { ComposioLinkedInProfileResponse } from "@/types/connections";

export const LINKEDIN_PROFILE_STORAGE_KEY = "linkedinProfile";

export function loadLinkedInProfileFromLocalStorage(): ComposioLinkedInProfileResponse | null {
  const raw = localStorage.getItem(LINKEDIN_PROFILE_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ComposioLinkedInProfileResponse;
  } catch {
    localStorage.removeItem(LINKEDIN_PROFILE_STORAGE_KEY);
    return null;
  }
}

export function buildLinkedInProfileSummary(profile: ComposioLinkedInProfileResponse): string {
  const name = `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim();
  const headline =
    profile.localizedHeadline ||
    (typeof profile.headline === "string" ? profile.headline : undefined) ||
    (profile.headline?.localized ? String(Object.values(profile.headline.localized)[0] || "") : undefined) ||
    "";

  const profileUrl =
    profile.profileUrl ||
    profile.vanityName
      ? `https://www.linkedin.com/in/${profile.vanityName}`
      : "";

  const parts = [];
  if (name) parts.push(`Name: ${name}`);
  if (headline) parts.push(`Headline: ${headline}`);
  if (profileUrl) parts.push(`LinkedIn: ${profileUrl}`);

  return parts.join("\n");
}
