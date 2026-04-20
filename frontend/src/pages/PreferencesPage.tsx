import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNavRail } from "../components/AppNavRail";
import { ThemeToggle } from "../components/ThemeToggle";
import { fetchPreferencesMe, logPreferences } from "../api/preferences";
import { PREFERENCE_QUESTIONS } from "../config/preferenceQuestions";

function initialAnswers(): Record<string, string> {
  return Object.fromEntries(PREFERENCE_QUESTIONS.map((q) => [q.id, ""]));
}

function mergeAnswersFromApi(raw: Record<string, string> | undefined): Record<string, string> {
  const next = initialAnswers();
  if (!raw) return next;
  for (const q of PREFERENCE_QUESTIONS) {
    next[q.id] = String(raw[q.id] ?? "").trim();
  }
  return next;
}

export function PreferencesPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, string> | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState("loading");
      setLoadError(null);
      try {
        const { answers: raw } = await fetchPreferencesMe();
        if (cancelled) return;
        const merged = mergeAnswersFromApi(raw);
        setAnswers(merged);
        setSavedSnapshot(merged);
        setLoadState("ok");
      } catch (err) {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(err instanceof Error ? err.message : "Could not load preferences");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allFilled = useMemo(
    () => PREFERENCE_QUESTIONS.every((q) => answers[q.id]?.trim().length > 0),
    [answers],
  );

  function setField(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allFilled) {
      setError("Please answer every question.");
      return;
    }
    const payload: Record<string, string> = {};
    for (const q of PREFERENCE_QUESTIONS) {
      payload[q.id] = answers[q.id]!.trim();
    }
    setBusy(true);
    try {
      await logPreferences(payload);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AppNavRail />
      <div className="main">
        <div className="settings-shell settings-shell--embedded">
          <header className="page-header">
            <div className="page-header-fill" aria-hidden />
            <div className="page-header-trailing">
              <ThemeToggle />
            </div>
          </header>

          <div className="settings-body">
            <div className="animate-in settings-hero">
              <h1 className="settings-title">Customize your experience.</h1>
              <p className="meta settings-intro">
                This helps us tailor your content. Answers are saved to your profile in the database.
              </p>
            </div>

            {loadState === "error" ? (
              <p className="banner error banner--spaced" role="alert">
                {loadError}
              </p>
            ) : null}

            {loadState === "ok" && savedSnapshot ? (
              <section className="pref-saved-deck animate-in" aria-labelledby="pref-saved-heading">
                <h2 id="pref-saved-heading" className="pref-saved-heading">
                  Your saved preferences
                </h2>
                <div className="pref-saved-grid">
                  {PREFERENCE_QUESTIONS.map((q) => {
                    const text = savedSnapshot[q.id]?.trim();
                    return (
                      <article key={q.id} className="card pref-saved-card">
                        <p className="pref-saved-card-label">{q.label}</p>
                        <p className="pref-saved-card-value">{text ? text : "—"}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : loadState === "loading" ? (
              <p className="meta pref-saved-loading" aria-live="polite">
                Loading your preferences…
              </p>
            ) : null}

            <form onSubmit={onSubmit} className="settings-feed settings-form">
              {error ? (
                <p className="banner error banner--spaced" role="alert">
                  {error}
                </p>
              ) : null}

              {PREFERENCE_QUESTIONS.map((q, index) => (
                <div key={q.id} className="card animate-in pref-card">
                  <div className="pref-card-label">
                    <span className="pref-card-num">{index + 1}</span>
                    <span className="pref-card-sep" aria-hidden>
                      ·
                    </span>
                    <span className="pref-card-slug">{q.id}</span>
                  </div>
                  <label className="label" htmlFor={`pref-${q.id}`}>
                    {q.label}
                  </label>
                  {q.helper ? <p className="form-hint">{q.helper}</p> : null}
                  <textarea
                    id={`pref-${q.id}`}
                    className="input"
                    rows={3}
                    placeholder={q.placeholder}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setField(q.id, e.target.value)}
                    disabled={busy || loadState === "loading"}
                  />
                </div>
              ))}

              <div className="row end pref-footer animate-in">
                <button
                  className="btn primary"
                  type="submit"
                  disabled={busy || !allFilled || loadState === "loading"}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
