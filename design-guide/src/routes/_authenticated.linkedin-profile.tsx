import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Globe, RefreshCw, Sparkles, UserCheck } from "lucide-react";
import type { ComposioLinkedInProfileResponse } from "@/types/connections";

const LINKEDIN_PROFILE_STORAGE_KEY = "linkedinProfile";

function loadLinkedInProfileFromLocalStorage(): ComposioLinkedInProfileResponse | null {
  const raw = localStorage.getItem(LINKEDIN_PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ComposioLinkedInProfileResponse;
  } catch {
    localStorage.removeItem(LINKEDIN_PROFILE_STORAGE_KEY);
    return null;
  }
}

export const Route = createFileRoute("/_authenticated/linkedin-profile")({
  head: () => ({
    meta: [
      { title: "LinkedIn Profile — Social AI" },
      { name: "description", content: "View connected LinkedIn profile details and AI context preview." },
    ],
  }),
  component: LinkedInProfilePage,
});

function getProfileData(profile: ComposioLinkedInProfileResponse) {
  const name = `${profile.localizedFirstName || ""} ${profile.localizedLastName || ""}`.trim();

  const headline = profile.localizedHeadline ||
    (typeof profile.headline === "string" ? profile.headline : undefined) ||
    (profile.headline?.localized ? String(Object.values(profile.headline.localized)[0] || "") : undefined) ||
    "";

  let picture = profile.profilePicture?.displayImage || "";
  if (!picture) {
    picture = profile.picture || "";
    if (!picture) {
      const elements = profile.profilePicture?.["displayImage~"]?.elements;
      if (elements && elements.length > 0) {
        const identifiers = elements[elements.length - 1]?.identifiers;
        if (identifiers && identifiers.length > 0) {
          picture = identifiers[0]?.identifier || "";
        }
      }
    }
  }

  const id = profile.id || profile.sub || "";

  return {
    name,
    headline,
    picture,
    profileUrl: profile.profileUrl || "",
    vanityName: profile.vanityName || "",
    id,
  };
}

function LinkedInProfilePage() {
  const [profile, setProfile] = useState<ComposioLinkedInProfileResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState("loading");
      setLoadError(null);
      setProfile(null);
      try {
        const cachedProfile = loadLinkedInProfileFromLocalStorage();
        if (!cachedProfile) {
          throw new Error("LinkedIn profile not found in local storage");
        }
        if (cancelled) return;
        setProfile(cachedProfile);
        setLoadState("ok");
      } catch (err) {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(err instanceof Error ? err.message : "Failed to load profile from local storage");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    setLoadError(null);
    setProfile(null);
    try {
      const cachedProfile = loadLinkedInProfileFromLocalStorage();
      if (!cachedProfile) {
        throw new Error("LinkedIn profile not found in local storage");
      }
      setProfile(cachedProfile);
      setLoadState("ok");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to load profile from local storage";
      setLoadError(errMsg);
    }
  };

  const parsedProfile = profile ? getProfileData(profile) : null;
  const initials = parsedProfile?.name
    ? parsedProfile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "LI";

  return (
    <>
      <PageHeader title="LinkedIn profile">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          title="Refresh local profile"
          disabled={loadState === "loading"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors duration-150 disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </PageHeader>
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto max-w-2xl space-y-6"
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              Manage your connected LinkedIn identity. The profile data fetched below serves as dynamic context to customize and refine generated AI content.
            </p>

            {/* Error & Not Connected State */}
            {loadState === "error" && isNotConnected ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 py-12 text-center shadow-[var(--shadow-sm)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface border border-border mb-4">
                  <Globe className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="font-heading text-base font-bold text-foreground">LinkedIn Not Connected</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                  Your LinkedIn account is not currently connected. Please connect it first in the Social Connections page to fetch profile information.
                </p>
                <div className="mt-6">
                  <Link
                    to="/connections"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:brightness-110"
                  >
                    Go to connections
                  </Link>
                </div>
              </motion.div>
            ) : loadState === "error" ? (
              <p
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {loadError}
              </p>
            ) : null}

            {/* Profile Success State */}
            {loadState === "ok" && parsedProfile && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Profile Card Banner */}
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-sm)]">
                  {/* Styled Mesh/Gradient Banner Header */}
                  <div className="h-24 bg-[image:var(--gradient-mesh)] opacity-90 border-b border-border/10" />

                  <div className="relative p-6 pt-0">
                    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
                      {/* Profile Picture */}
                      {parsedProfile.picture ? (
                        <img
                          src={parsedProfile.picture}
                          alt={parsedProfile.name}
                          className="relative -mt-10 h-20 w-20 shrink-0 rounded-xl border-4 border-card bg-surface object-cover shadow-[var(--shadow-sm)]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="relative -mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-4 border-card bg-[image:var(--gradient-accent)] text-lg font-bold text-white shadow-[var(--shadow-sm)]">
                          {initials}
                        </div>
                      )}

                      {/* Name & Headline */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {parsedProfile.name ? (
                            <h2 className="font-heading text-lg font-bold text-foreground">
                              {parsedProfile.name}
                            </h2>
                          ) : null}
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <UserCheck className="h-3 w-3" />
                            Connected via LinkedIn
                          </span>
                        </div>
                        {parsedProfile.headline ? (
                          <p className="mt-1 text-sm text-muted-foreground leading-normal">
                            {parsedProfile.headline}
                          </p>
                        ) : null}
                        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                          {parsedProfile.vanityName ? (
                            <p>
                              <span className="font-medium text-foreground">Username:</span> {parsedProfile.vanityName}
                            </p>
                          ) : null}
                          {parsedProfile.profileUrl ? (
                            <p>
                              <span className="font-medium text-foreground">Profile URL:</span>{" "}
                              <a
                                href={parsedProfile.profileUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="font-medium text-primary hover:underline"
                              >
                                {parsedProfile.profileUrl}
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* ID / URN Chip */}
                    {parsedProfile.id && (
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-[11px] text-muted-foreground">
                        <span>LinkedIn member ID</span>
                        <code className="rounded bg-surface px-1.5 py-0.5 text-foreground font-mono text-[10px] border border-border">
                          {parsedProfile.id}
                        </code>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Context Card */}
                <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-sm)] transition-shadow duration-150 hover:shadow-[var(--shadow-card)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4.5 w-4.5 text-primary" />
                    <h3 className="font-heading text-sm font-bold text-foreground">AI Context</h3>
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground">
                    This profile information will be included as context when generating AI-powered LinkedIn posts to help produce more personalized and consistent content.
                  </p>

                  <div className="mt-5 border-t border-border pt-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        AI Receives:
                      </span>
                    </div>

                    <ul className="space-y-2.5 pl-5 list-disc text-sm text-foreground/80">
                      {parsedProfile.name ? (
                        <li>
                          <strong>Name:</strong> {parsedProfile.name}
                        </li>
                      ) : null}
                      {parsedProfile.headline ? (
                        <li>
                          <strong>Headline:</strong> {parsedProfile.headline}
                        </li>
                      ) : null}
                      {parsedProfile.vanityName ? (
                        <li>
                          <strong>LinkedIn username:</strong> {parsedProfile.vanityName}
                        </li>
                      ) : null}
                      {parsedProfile.profileUrl ? (
                        <li>
                          <strong>Profile URL:</strong> {parsedProfile.profileUrl}
                        </li>
                      ) : null}
                      {parsedProfile.id ? (
                        <li>
                          <strong>Profile identifier:</strong> {parsedProfile.id}
                        </li>
                      ) : null}
                      <li>
                        <strong>Brand identity:</strong> Derived from profile headline and connection context
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}
