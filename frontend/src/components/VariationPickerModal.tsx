import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PostVariation } from "../types/generate";

const PREVIEW_IMAGE =
  "https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg";

type Props = {
  open: boolean;
  variations: PostVariation[];
  canPersist: boolean;
  busy: boolean;
  reworkBusy?: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (v: PostVariation) => void;
  /** Rework: `v.text` is the liked base draft; `instructions` are change requests for the model only (stored separately, not posted). */
  onRework: (v: PostVariation, instructions: string) => void;
};

export function VariationPickerModal({
  open,
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
  /** Only one card shows the regenerate UI at a time; collapsed until the user expands that option. */
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

  if (!open || variations.length === 0) return null;

  const anyBusy = busy || reworkBusy;

  const node = (
    <div className="variation-modal-root" role="presentation">
      <button
        type="button"
        className="variation-modal-backdrop"
        aria-label="Close picker"
        onClick={onClose}
      />
      <div
        className="variation-modal-panel animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="variation-modal-header">
          <div>
            <h2 id={titleId} className="variation-modal-title">
              Choose a draft
            </h2>
            <p className="variation-modal-sub">
              Two drafts are ready. Pick one to load it into the composer and unlock Post to X.
            </p>
          </div>
          <button type="button" className="btn muted variation-modal-close" onClick={onClose}>
            Close
          </button>
        </header>

        {!canPersist ? (
          <p className="banner error variation-modal-error" role="status">
            Connect the database to save your pick to this draft. You can still compare both variants and regenerate
            one option with AI below.
          </p>
        ) : null}

        {error ? (
          <p className="banner error variation-modal-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="variation-modal-grid">
          {variations.map((v) => {
            const reworkId = `rework-${reworkFieldPrefix}-${v.variation_id}`;
            const note = reworkNotes[v.variation_id] ?? "";
            const canRework = note.trim().length >= 3;
            const reworkOpen = reworkExpandedId === v.variation_id;

            return (
              <article key={v.variation_id} className="variation-modal-card">
                <div className="variation-modal-card-thumb-wrap">
                  <img
                    src={PREVIEW_IMAGE}
                    alt=""
                    className="variation-modal-card-thumb"
                    width={400}
                    height={220}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="variation-modal-card-badge">Option {v.variation_id}</span>
                </div>
                <div className="variation-modal-card-body">
                  <p className="variation-modal-card-text">{v.text}</p>
                  <p className="variation-modal-tags">{v.hashtags.join(" ")}</p>

                  <div className="variation-modal-card-actions">
                    <button
                      type="button"
                      className="btn primary variation-modal-select"
                      disabled={busy}
                      title={!canPersist ? "This pick will load locally without DB persistence" : undefined}
                      onClick={() => onSelect(v)}
                    >
                      {busy ? "Saving…" : canPersist ? "Use this variant" : "Use this variant (local)"}
                    </button>
                  </div>

                  {!reworkOpen ? (
                    <button
                      type="button"
                      className="btn ghost variation-modal-refine-toggle"
                      disabled={anyBusy}
                      aria-expanded={false}
                      onClick={() => setReworkExpandedId(v.variation_id)}
                    >
                      Regenerate from this option…
                    </button>
                  ) : (
                    <div className="variation-modal-rework">
                      <div className="variation-modal-rework-header">
                        <span className="variation-modal-rework-title">Edit and regenerate option {v.variation_id}</span>
                        <button
                          type="button"
                          className="btn muted variation-modal-rework-cancel"
                          disabled={anyBusy}
                          onClick={() => setReworkExpandedId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                      <textarea
                        id={reworkId}
                        className="input variation-modal-rework-textarea"
                        rows={3}
                        aria-label="Describe the changes you want the AI to make to this draft"
                        value={note}
                        disabled={anyBusy}
                        onChange={(e) =>
                          setReworkNotes((prev) => ({
                            ...prev,
                            [v.variation_id]: e.target.value,
                          }))
                        }
                      />
                      <p className="variation-modal-rework-hint" aria-live="polite">
                        {canRework
                          ? "Ready—two new drafts will use this tweet plus your change notes."
                          : `${Math.max(0, 3 - note.trim().length)} more characters to describe your edits.`}
                      </p>
                      <button
                        type="button"
                        className="btn muted variation-modal-rework-btn"
                        disabled={anyBusy || !canRework}
                        onClick={() => onRework(v, note.trim())}
                      >
                        {reworkBusy ? "Generating…" : "Regenerate with AI"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
