import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchPreferencesMe, logPreferences } from "@/api/preferences";
import { PREFERENCE_QUESTIONS } from "@/config/preferenceQuestions";

export const Route = createFileRoute("/_authenticated/preferences")({
  head: () => ({
    meta: [
      { title: "Preferences — Social AI" },
      { name: "description", content: "Set your content preferences for AI-generated posts." },
    ],
  }),
  component: PreferencesPage,
});

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

function PreferencesPage() {
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
      void navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save preferences");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Preferences" />
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Customize your experience. This helps us tailor your content. Answers are saved to
              your profile in the database.
            </p>

            {loadState === "error" ? (
              <p
                className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {loadError}
              </p>
            ) : null}

            {loadState === "ok" && savedSnapshot ? (
              <section className="mb-8" aria-labelledby="pref-saved-heading">
                <h2 id="pref-saved-heading" className="mb-3 text-sm font-semibold text-foreground">
                  Your saved preferences
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {PREFERENCE_QUESTIONS.map((q) => {
                    const text = savedSnapshot[q.id]?.trim();
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-sm)]"
                      >
                        <p className="text-xs font-medium text-muted-foreground">{q.label}</p>
                        <p className="mt-1 text-sm text-card-foreground">{text ? text : "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : loadState === "loading" ? (
              <p className="mb-6 text-sm text-muted-foreground" aria-live="polite">
                Loading your preferences…
              </p>
            ) : null}

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
              {error ? (
                <p
                  className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PREFERENCE_QUESTIONS.map((q, i) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                    className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]"
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{i + 1}</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono">{q.id}</span>
                    </div>
                    <label
                      className="block text-sm font-medium text-card-foreground"
                      htmlFor={`pref-${q.id}`}
                    >
                      {q.label}
                    </label>
                    {q.helper ? (
                      <p className="mt-1 text-xs text-muted-foreground">{q.helper}</p>
                    ) : null}
                    <textarea
                      id={`pref-${q.id}`}
                      rows={3}
                      placeholder={q.placeholder}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setField(q.id, e.target.value)}
                      disabled={busy || loadState === "loading"}
                      className="mt-3 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/40 transition-all focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15 disabled:opacity-50"
                    />
                  </motion.div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex h-10 items-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all hover:brightness-110 disabled:opacity-40"
                  disabled={busy || !allFilled || loadState === "loading"}
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </>
  );
}
