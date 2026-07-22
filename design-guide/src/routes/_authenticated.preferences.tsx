import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { fetchPreferencesMe, logPreferences } from "@/api/preferences";
import { useLoading } from "@/components/LoadingOverlay";
import { PREFERENCE_QUESTIONS } from "@/config/preferenceQuestions";

// export const Route = createFileRoute("/_authenticated/preferences")({
//   head: () => ({
//     meta: [
//       { title: "Preferences — Social AI" },
//       { name: "description", content: "Set your content preferences for AI-generated posts." },
//     ],
//   }),
//   component: PreferencesPage,
// });

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

export default function PreferencesPage() {
  const navigate = useNavigate();
  const { withLoader } = useLoading();
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
        const { answers: raw } = await withLoader(() => fetchPreferencesMe());
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
     
<div className="flex-1 mt-10">
  {/* Header */}
  <div className="max-w-7xl mx-auto   pb-20">
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {loadState === "error" ? (
        <p
          className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {loadError}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p className="mb-6 text-sm text-slate-500" aria-live="polite">
          Loading your preferences…
        </p>
      ) : null}

      <div className="mb-8 flex items-center gap-3">
        <div className="h-8 w-1 bg-[#5d5cde] rounded-full" />
        <h2 className="text-xl font-bold text-slate-800">Your preferences</h2>
      </div>

      <form onSubmit={(e) => void onSubmit(e)}>
        {error ? (
          <p
            className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PREFERENCE_QUESTIONS.map((q, i) => (
            <motion.article
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex flex-col bg-white border border-slate-100 rounded-custom p-6 shadow-premium shadow-premium-hover transition-all duration-300 hover:border-[#5d5cde]/20"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#5d5cde]/60 bg-[#5d5cde]/5 px-2 py-1 rounded">
                  {i + 1} · {q.id}
                </span>
              </div>

              <label
                className="block text-lg font-bold text-slate-800 mb-2"
                htmlFor={`pref-${q.id}`}
              >
                {q.label}
              </label>
              {q.helper ? (
                <p className="text-sm text-slate-500 mb-4">{q.helper}</p>
              ) : null}

              <textarea
                id={`pref-${q.id}`}
                rows={3}
                placeholder={q.placeholder}
                value={answers[q.id] ?? ""}
                onChange={(e) => setField(q.id, e.target.value)}
                disabled={busy || loadState === "loading"}
                className="mt-auto w-full resize-none rounded-custom border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:border-[#5d5cde] focus:outline-none focus:ring-2 focus:ring-[#5d5cde]/15 disabled:opacity-50"
              />
            </motion.article>
          ))}
        </div>

        <footer className="mt-12 flex justify-end items-center gap-4 border-t border-slate-200 pt-8">
          <button
            type="button"
            className="px-6 py-2.5 text-slate-500 font-medium hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-[#5d5cde] hover:bg-[#5d5cde]/90 text-white px-10 py-3 rounded-custom font-bold shadow-lg shadow-[#5d5cde]/25 transition-all transform active:scale-95 disabled:opacity-40"
            disabled={busy || !allFilled || loadState === "loading"}
          >
            {busy ? "Saving…" : "Save Preferences"}
          </button>
        </footer>
      </form>
    </motion.div>
  </div>
</div>
    </>
  );
}
