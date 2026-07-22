import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink, AtSign, Globe } from "lucide-react";
import xLogo from "../../public/commonImg/Screenshot 2026-07-22 114313.png"
import linkDin from "../../public/commonImg/pngegg.png"
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
    icon: string;
    connected: boolean;
    description: string;
  }[] = [
      {
        platform: "linkedin",
        name: "LinkedIn",
        icon: linkDin,
        connected: linkedin,
        description: "Connect your Twitter account to publish posts directly.",
      },
      {
        platform: "twitter",
        name: "Twitter / X",
        icon: xLogo,
        connected: twitter,
        description: "Connect your Twitter account to publish posts directly.",
      },
    ];

  return (
    <>
  <div className="flex-1">
  <div className="px-8 py-8 lg:px-12">
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-2">
          Connect your social media accounts
        </h2>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((conn, i) => (
          <motion.div
            key={conn.platform}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="conn-card p-6 flex flex-col md:flex-row gap-6 items-start transition-all hover:-translate-y-1 h-full min-h-[180px]"
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border border-outline-variant ${
                conn.connected
                  ? "bg-primary-container"
                  : "bg-surface-container "
              }`}
            >
              <img
                src={conn.icon}
                alt={conn.name}
                className="h-8 w-8 object-contain"
              />
            </div>

            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-on-surface truncate">
                  {conn.name}
                </h3>
                {conn.connected ? (
                  <span className="inline-flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-full text-[11px] font-bold shrink-0">
                    <Check className="h-3.5 w-3.5" />
                    Connected
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-full shrink-0">
                    Not Connected
                  </span>
                )}
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed">
                {conn.description}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy !== null || conn.connected}
                  onClick={() => void onConnect(conn.platform)}
                  className="conn-btn-shadow flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {busy === conn.platform
                    ? "Redirecting…"
                    : `Connect ${conn.name.split("/")[0]?.trim() ?? conn.platform}`}
                </button>
                <button
                  type="button"
                  disabled={busy !== null || conn.connected}
                  onClick={() => void onVerify(conn.platform)}
                  className="flex h-9 items-center rounded-lg border border-outline-variant bg-surface-container-highest px-3.5 text-xs font-medium text-on-surface transition-colors hover:bg-surface-variant disabled:opacity-40"
                >
                  {busy === "verify" ? "Verifying…" : "Verify"}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  </div>
</div>
    </>
  );
}
