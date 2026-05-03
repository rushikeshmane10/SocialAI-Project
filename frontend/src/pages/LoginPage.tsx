import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "../components/ThemeToggle";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/preferences" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate("/preferences", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-page-inner">
        <header className="login-page-top">
          <span className="login-page-wordmark">Social AI</span>
          <ThemeToggle />
        </header>

        <div className="login-page-card animate-in">
          <header className="login-page-card-head">
            <h1 className="login-page-title">Welcome back</h1>
            <p className="login-page-sub">Sign in to your account.</p>
          </header>

          <form className="login-page-form" onSubmit={onSubmit}>
            {error ? (
              <p className="banner error banner--spaced login-page-banner" role="alert">
                {error}
              </p>
            ) : null}

            <div className="field">
              <label className="label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <button className="btn primary full lg" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="divider-or login-page-divider" aria-hidden>
            <span>or</span>
          </div>

          <button type="button" className="btn ghost full lg" disabled={busy}>
            Create new account
          </button>

          <button type="button" className="link-meta-btn login-page-link">
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}
