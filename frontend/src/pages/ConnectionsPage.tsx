import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  completeConnection,
  fetchConnectionStatus,
  initiateConnection,
  type ConnectionPlatform,
} from "../api/connections";
import { AppNavRail } from "../components/AppNavRail";
import { ThemeToggle } from "../components/ThemeToggle";

export function ConnectionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    const verify = searchParams.get("verify");
    if (verify !== "twitter" && verify !== "linkedin") return;
    let cancelled = false;
    (async () => {
      setBusy(verify);
      setActionError(null);
      try {
        await completeConnection(verify);
        if (!cancelled) {
          await refreshStatus();
          setSearchParams({}, { replace: true });
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
  }, [searchParams, setSearchParams, refreshStatus]);

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
      await refreshStatus();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="app-shell">
      <AppNavRail />
      <main className="main">
        <header className="page-header">
          <h1 className="page-title">Social connections</h1>
          <div className="row end">
            <ThemeToggle />
          </div>
        </header>
        <p className="compose-lead">
          Connect your publishing channels once and we will keep your posting workflow seamless. Use verify if you
          return manually after OAuth.
        </p>

        <div className="connections-page">
          {loadError && (
            <p className="banner error banner--spaced" role="alert">
              {loadError}
            </p>
          )}
          {actionError && (
            <p className="banner error banner--spaced" role="alert">
              {actionError}
            </p>
          )}

          <section className="connections-grid" aria-label="Connection status and actions">
            <article className="card connection-card animate-in">
              <div className="connection-head">
                <div>
                  <p className="card-label">Platform</p>
                  <h2 className="connection-title">Twitter</h2>
                </div>
                <span className={`connection-status ${twitter ? "is-connected" : "is-disconnected"}`}>
                  {twitter ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="meta connection-meta">
                {twitter
                  ? "Your account is linked and ready for publishing."
                  : "Authenticate once to enable posting from the generator."}
              </p>
              <div className="row connection-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy !== null || twitter}
                  onClick={() => void onConnect("twitter")}
                >
                  {busy === "twitter" ? "Redirecting…" : "Connect Twitter"}
                </button>
                <button
                  type="button"
                  className="btn muted"
                  disabled={busy !== null || twitter}
                  onClick={() => void onVerify("twitter")}
                >
                  Verify
                </button>
              </div>
            </article>

            <article className="card connection-card animate-in">
              <div className="connection-head">
                <div>
                  <p className="card-label">Platform</p>
                  <h2 className="connection-title">LinkedIn</h2>
                </div>
                <span className={`connection-status ${linkedin ? "is-connected" : "is-disconnected"}`}>
                  {linkedin ? "Connected" : "Not connected"}
                </span>
              </div>
              <p className="meta connection-meta">
                {linkedin
                  ? "Your account is linked and ready for publishing."
                  : "Authenticate once to enable posting from the generator."}
              </p>
              <div className="row connection-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy !== null || linkedin}
                  onClick={() => void onConnect("linkedin")}
                >
                  {busy === "linkedin" ? "Redirecting…" : "Connect LinkedIn"}
                </button>
                <button
                  type="button"
                  className="btn muted"
                  disabled={busy !== null || linkedin}
                  onClick={() => void onVerify("linkedin")}
                >
                  Verify
                </button>
              </div>
            </article>
          </section>

          <p className="meta connections-note">
            Optional: set Composio redirect to this app with query <code>?verify=twitter</code> or{" "}
            <code>?verify=linkedin</code> to auto-verify on return.
          </p>
          <div className="row">
            <button type="button" className="btn ghost" onClick={() => navigate("/")}>
              Back to generator
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
