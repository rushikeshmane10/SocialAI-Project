import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Login is always black / blue-accented. Strip `theme-x` while this route is
 * mounted so the global theme toggle does not affect this screen; restore from
 * localStorage on leave.
 */
function useLoginThemeIsolation() {
  useEffect(() => {
    const root = document.documentElement;
    document.body.classList.add("login-route");

    let storedDark = false;
    try {
      storedDark = localStorage.getItem("theme-preference") === "dark";
    } catch {
      /* ignore */
    }

    root.classList.remove("theme-x");

    return () => {
      document.body.classList.remove("login-route");
      try {
        if (localStorage.getItem("theme-preference") === "dark") {
          root.classList.add("theme-x");
        } else {
          root.classList.remove("theme-x");
        }
      } catch {
        if (storedDark) root.classList.add("theme-x");
        else root.classList.remove("theme-x");
      }
    };
  }, []);
}

export function LoginPage() {
  useLoginThemeIsolation();
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

          <button className="btn primary full login-page-btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="divider-or login-page-divider" aria-hidden>
          <span>or</span>
        </div>

        <button type="button" className="btn ghost full login-page-btn-outline" disabled={busy}>
          Create new account
        </button>

        <button type="button" className="link-meta-btn login-page-link">
          Forgot password?
        </button>
      </div>
    </div>
  );
}
