import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import type { ComposioLinkedInProfileResponse } from "@/types/connections";

const STORAGE_KEY = "linkedinProfile";

function resolveProfileName(profile: ComposioLinkedInProfileResponse): string {
  return `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim();
}

function resolveProfileHeadline(profile: ComposioLinkedInProfileResponse): string {
  return (
    profile.localizedHeadline ||
    (typeof profile.headline === "string" ? profile.headline : undefined) ||
    (profile.headline?.localized ? String(Object.values(profile.headline.localized)[0] || "") : undefined) ||
    ""
  );
}

function resolveProfileImage(profile: ComposioLinkedInProfileResponse): string {
  const displayImage = profile.profilePicture?.displayImage;
  if (displayImage) return displayImage;
  const picture = profile.picture;
  if (picture) return picture;

  const elements = profile.profilePicture?.["displayImage~"]?.elements;
  if (elements && elements.length > 0) {
    const identifiers = elements[elements.length - 1]?.identifiers;
    if (identifiers && identifiers.length > 0) {
      return identifiers[0]?.identifier || "";
    }
  }

  return "";
}

export function LinkedInContextCard() {
  const [profile, setProfile] = useState<ComposioLinkedInProfileResponse | null>(null);
  const [useProfile, setUseProfile] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as ComposioLinkedInProfileResponse;
      setProfile(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  if (!profile) return null;

  const name = resolveProfileName(profile);
  const headline = resolveProfileHeadline(profile);
  const profileImage = resolveProfileImage(profile);
  const initials = name
    ? name
        .split(" ")
        .map((segment) => segment[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "LI";

  if (!name && !headline && !profileImage) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-surface">
            {profileImage ? (
              <img src={profileImage} alt={name || "LinkedIn profile"} className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-sm font-semibold text-muted-foreground">
                {initials}
              </div>
            )}
          </div>

          <div className="min-w-0">
            {name ? (
              <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            ) : null}
            {headline ? (
              <p className="truncate text-xs text-muted-foreground">{headline}</p>
            ) : null}

            <div className="mt-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                LinkedIn
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                <UserCheck className="h-3 w-3" />
                AI Context
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-start">
          <label className="inline-flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useProfile}
              onChange={() => setUseProfile((s) => !s)}
              className="h-4 w-4 rounded border border-border bg-background text-primary focus:ring-0"
            />
            <span className="text-sm text-muted-foreground">Use LinkedIn profile as AI context</span>
          </label>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">Your LinkedIn profile will be used to personalize AI-generated posts.</p>
    </div>
  );
}
