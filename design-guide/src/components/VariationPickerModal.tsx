import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { PostVariation } from "@/types/generate";

type Props = {
  open: boolean;
  loading?: boolean;
  modelLabel?: string;
  variations: PostVariation[];
  canPersist: boolean;
  busy: boolean;
  reworkBusy?: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (v: PostVariation) => void;
  onRework: (v: PostVariation, instructions: string) => void;
};

function LoadingCard({ optionIndex }: { optionIndex: number }) {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-muted" />
        <span className="text-[11px] font-semibold text-muted-foreground">
          Option {optionIndex}
        </span>
      </div>
      <div className="mb-3 aspect-[16/10] w-full rounded-lg bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-[92%] rounded bg-muted" />
        <div className="h-3 w-[78%] rounded bg-muted" />
      </div>
      <div className="mt-4 h-9 w-full rounded-lg bg-muted" />
    </div>
  );
}

export function VariationPickerModal({
  open,
  loading = false,
  modelLabel,
  variations,
  canPersist,
  busy,
  reworkBusy = false,
  error,
  onClose,
  onSelect,
  onRework,
}: Props) {
  const titleId = useId();
  const reworkFieldPrefix = useId().replace(/:/g, "");
  const [reworkNotes, setReworkNotes] = useState<Record<number, string>>({});
  const [reworkExpandedId, setReworkExpandedId] = useState<number | null>(null);

  const variationKey = useMemo(
    () => variations.map((x) => `${x.variation_id}:${x.text}`).join("|"),
    [variations],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setReworkNotes({});
      setReworkExpandedId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setReworkNotes({});
    setReworkExpandedId(null);
  }, [open, variationKey]);

  if (!open || typeof document === "undefined") return null;

  const showSkeleton = loading && variations.length !== 2;
  if (!showSkeleton && variations.length !== 2) return null;

  const anyBusy = busy || reworkBusy;

  const panel = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-busy={showSkeleton}
            onClick={(e) => e.stopPropagation()}
            className="relative z-[101] mx-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-modal)] lg:p-8"
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id={titleId} className="font-heading pr-10 text-lg font-bold text-card-foreground">
              {showSkeleton ? "Generating drafts" : "Choose a draft"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {showSkeleton ? (
                <>
                  {modelLabel ? (
                    <>
                      Using <span className="font-medium text-foreground">{modelLabel}</span>. Both
                      options will appear when ready.
                    </>
                  ) : (
                    "Both options will appear when ready."
                  )}
                </>
              ) : (
                "Pick one to load it into the composer and unlock posting."
              )}
            </p>

            {!showSkeleton && !canPersist ? (
              <p
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="status"
              >
                Connect the database to save your pick to this draft. You can still compare both
                variants and regenerate below.
              </p>
            ) : null}

            {error ? (
              <p
                className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {showSkeleton ? (
                <>
                  <LoadingCard optionIndex={1} />
                  <LoadingCard optionIndex={2} />
                </>
              ) : (
                variations.map((v) => {
                  const reworkId = `rework-${reworkFieldPrefix}-${v.variation_id}`;
                  const note = reworkNotes[v.variation_id] ?? "";
                  const canRework = note.trim().length >= 3;
                  const reworkOpen = reworkExpandedId === v.variation_id;
                  const base64Image =
                    typeof v.image_base64 === "string" ? v.image_base64.trim() : "";
                  const imageSrc =
                    base64Image.length === 0
                      ? null
                      : base64Image.startsWith("data:image/")
                        ? base64Image
                        : `data:image/jpeg;base64,${base64Image}`;

                  return (
                    <div
                      key={v.variation_id}
                      className="rounded-xl border border-border bg-background p-5 shadow-[var(--shadow-sm)]"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          Option {v.variation_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Tone: {v.tone_applied}
                        </span>
                      </div>
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt=""
                          className="mb-3 w-full rounded-lg border border-border object-cover"
                          style={{ maxHeight: 220 }}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="mb-3 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
                          No image
                        </div>
                      )}
                      <p className="text-sm leading-relaxed text-foreground">{v.text}</p>
                      {v.hashtags.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {v.hashtags.map((h) => `#${h}`).join(" ")}
                        </p>
                      )}

                      <div className="mt-4">
                        <button
                          type="button"
                          disabled={busy || !canPersist}
                          title={
                            !canPersist
                              ? "Selection requires a persisted draft post id."
                              : undefined
                          }
                          onClick={() => onSelect(v)}
                          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sm)] transition-all hover:brightness-110 disabled:opacity-40"
                        >
                          {busy ? "Saving…" : "Use this variant"}
                        </button>
                      </div>

                      {!reworkOpen ? (
                        <button
                          type="button"
                          disabled={anyBusy}
                          className="mt-3 w-full rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                          onClick={() => setReworkExpandedId(v.variation_id)}
                        >
                          Regenerate from this option…
                        </button>
                      ) : (
                        <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              Refine option {v.variation_id}
                            </span>
                            <button
                              type="button"
                              disabled={anyBusy}
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => setReworkExpandedId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                          <textarea
                            id={reworkId}
                            rows={3}
                            value={note}
                            disabled={anyBusy}
                            onChange={(e) =>
                              setReworkNotes((prev) => ({
                                ...prev,
                                [v.variation_id]: e.target.value,
                              }))
                            }
                            placeholder="Describe the changes you want…"
                            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
                          />
                          <p className="text-[11px] text-muted-foreground" aria-live="polite">
                            {canRework
                              ? "Ready — two new drafts will use this text plus your notes."
                              : `${Math.max(0, 3 - note.trim().length)} more characters required.`}
                          </p>
                          <button
                            type="button"
                            disabled={anyBusy || !canRework}
                            onClick={() => onRework(v, note.trim())}
                            className="w-full rounded-lg border border-border py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40"
                          >
                            {reworkBusy ? "Generating…" : "Regenerate with AI"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}
