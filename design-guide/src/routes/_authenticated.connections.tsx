import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, AtSign, Globe } from "lucide-react";
import {
  completeConnection,
  fetchConnectionStatus,
  fetchLinkedInProfile,
  initiateConnection,
  type ConnectionPlatform,
} from "@/api/connections";
import type { ComposioLinkedInProfileResponse } from "@/types/connections";

const LINKEDIN_PROFILE_STORAGE_KEY = "linkedinProfile";

function saveLinkedInProfile(profile: ComposioLinkedInProfileResponse) {
  localStorage.setItem(LINKEDIN_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export const Route = createFileRoute("/_authenticated/connections")({
  validateSearch: (raw: Record<string, unknown>): { verify?: ConnectionPlatform } => {
    const v = raw.verify;
    if (v === "twitter" || v === "linkedin") return { verify: v };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Connections — Social AI" },
      { name: "description", content: "Connect your social accounts to publish content." },
    ],
  }),
  component: ConnectionsPage,
});

function ConnectionsPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [twitter, setTwitter] = useState(false);
  const [linkedin, setLinkedin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ConnectionPlatform | "verify" | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await fetchConnectionStatus();
      setTwitter(s.twitter);
      setLinkedin(s.linkedin);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load connection status");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const verify = search.verify;
    if (verify !== "twitter" && verify !== "linkedin") return;
    let cancelled = false;
    (async () => {
      setBusy(verify);
      setActionError(null);
      try {
        await completeConnection(verify);
        if (!cancelled) {
          if (verify === "linkedin") {
            try {
              const profile = await fetchLinkedInProfile();
              saveLinkedInProfile(profile);
            } catch (e) {
              setActionError(e instanceof Error ? e.message : "Could not fetch LinkedIn profile after verification");
              return;
            }
          }
          await refreshStatus();
          void navigate({ search: {}, replace: true });
        }
      } catch (e) {
        if (!cancelled) {
          setActionError(e instanceof Error ? e.message : "Verification failed");
        }
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.verify, navigate, refreshStatus]);

  async function onConnect(platform: ConnectionPlatform) {
    setActionError(null);
    setBusy(platform);
    try {
      const { redirectUrl } = await initiateConnection(platform);
      window.location.href = redirectUrl;
    } catch (e) {
      setBusy(null);
      setActionError(e instanceof Error ? e.message : "Could not start OAuth");
    }
  }

  async function onVerify(platform: ConnectionPlatform) {
    setActionError(null);
    setBusy("verify");
    try {
      await completeConnection(platform);
      if (platform === "linkedin") {
        try {
          const profile = await fetchLinkedInProfile();
          saveLinkedInProfile(profile);
        } catch (e) {
          setActionError(e instanceof Error ? e.message : "Could not fetch LinkedIn profile after verification");
          return;
        }
      }
      await refreshStatus();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  }

  const cards: {
    platform: ConnectionPlatform;
    name: string;
    icon: typeof AtSign;
    connected: boolean;
    description: string;
  }[] = [
      {
        platform: "twitter",
        name: "Twitter / X",
        icon: AtSign,
        connected: twitter,
        description: "Connect your Twitter account to publish posts directly.",
      },
      {
        platform: "linkedin",
        name: "LinkedIn",
        icon: Globe,
        connected: linkedin,
        description: "Connect your LinkedIn account to share professional content.",
      },
    ];

  return (
    <>
      <PageHeader title="Social connections" />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Connect your social media accounts to publish content directly from one place.
            </p>

            {loadError ? (
              <p
                className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {loadError}
              </p>
            ) : null}
            {actionError ? (
              <p
                className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {actionError}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((conn, i) => (
                <motion.div
                  key={conn.platform}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="group rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition-all duration-150 hover:shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface">
                      <conn.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-medium text-card-foreground">{conn.name}</h3>
                        {conn.connected && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Check className="h-3 w-3" />
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{conn.description}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy !== null || conn.connected}
                      onClick={() => void onConnect(conn.platform)}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:brightness-110 disabled:opacity-40"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {busy === conn.platform
                        ? "Redirecting…"
                        : `Connect ${conn.name.split("/")[0]?.trim() ?? conn.platform}`}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null || conn.connected}
                      onClick={() => void onVerify(conn.platform)}
                      className="flex h-8 items-center rounded-lg border border-border px-3.5 text-xs font-medium text-foreground shadow-[var(--shadow-sm)] transition-all duration-150 hover:bg-accent disabled:opacity-40"
                    >
                      {busy === "verify" ? "Verifying…" : "Verify"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => void navigate({ to: "/" })}
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Back to generator
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
