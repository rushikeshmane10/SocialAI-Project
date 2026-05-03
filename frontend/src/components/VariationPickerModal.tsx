import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PostVariation } from "../types/generate";

type Props = {
  open: boolean;
  /** When true, shows the same two-card layout with image + text shimmers until `variations` are ready. */
  loading?: boolean;
  /** Shown in the loading subtitle (e.g. selected LLM). */
  modelLabel?: string;
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

function LoadingOptionCard({ optionIndex }: { optionIndex: number }) {
  return (
    <article className="variation-modal-card variation-modal-card--loading" aria-hidden>
      <div className="variation-modal-card-thumb-wrap">
        <div className="skeleton variation-modal-card-thumb-skeleton" />
        <span className="variation-modal-card-badge">Option {optionIndex}</span>
      </div>
      <div className="variation-modal-card-body">
        <div className="skeleton variation-modal-skel-tone" />
        <div className="variation-modal-skel-lines" role="presentation">
          <div className="skeleton variation-modal-skel-line variation-modal-skel-line--w100" />
          <div className="skeleton variation-modal-skel-line variation-modal-skel-line--w92" />
          <div className="skeleton variation-modal-skel-line variation-modal-skel-line--w78" />
        </div>
        <div className="skeleton variation-modal-skel-tags" />
        <div className="variation-modal-card-actions">
          <div className="skeleton variation-modal-skel-btn" />
        </div>
        <div className="skeleton variation-modal-skel-refine" />
      </div>
    </article>
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

  if (!open) return null;

  const showSkeleton = loading && variations.length !== 2;
  if (!showSkeleton && variations.length !== 2) return null;

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
        aria-busy={showSkeleton}
      >
        <header className="variation-modal-header">
          <div>
            <h2 id={titleId} className="variation-modal-title">
              {showSkeleton ? "Generating drafts" : "Choose a draft"}
            </h2>
            <p className="variation-modal-sub">
              {showSkeleton ? (
                <>
                  {modelLabel ? (
                    <>
                      Using <span className="variation-modal-model-pill">{modelLabel}</span>. Image and text for both
                      options will appear here when ready.
                    </>
                  ) : (
                    "Image and text for both options will appear here when ready."
                  )}
                </>
              ) : (
                "Two drafts are ready. Pick one to load it into the composer and unlock Post to X."
              )}
            </p>
          </div>
          <button type="button" className="btn muted variation-modal-close" onClick={onClose}>
            Close
          </button>
        </header>

        {!showSkeleton && !canPersist ? (
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
          {showSkeleton ? (
            <>
              <LoadingOptionCard optionIndex={1} />
              <LoadingOptionCard optionIndex={2} />
            </>
          ) : null}
          {!showSkeleton
            ? variations.map((v) => {
                const reworkId = `rework-${reworkFieldPrefix}-${v.variation_id}`;
                const note = reworkNotes[v.variation_id] ?? "";
                const canRework = note.trim().length >= 3;
                const reworkOpen = reworkExpandedId === v.variation_id;
                const base64Image = typeof v.image_base64 === "string" ? v.image_base64.trim() : "";
                const imageSrc =
                  base64Image.length === 0
                    ? null
                    : base64Image.startsWith("data:image/")
                      ? base64Image
                      : `data:image/jpeg;base64,${base64Image}`;

                return (
                  <article key={v.variation_id} className="variation-modal-card">
                    <div className="variation-modal-card-thumb-wrap">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt="AI generated image for this tone"
                          style={{ width: "100%", borderRadius: "8px", marginBottom: "12px" }}
                          className="variation-modal-card-thumb"
                          width={400}
                          height={220}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div
                          className="variation-modal-card-thumb"
                          style={{
                            width: "100%",
                            minHeight: "220px",
                            borderRadius: "8px",
                            marginBottom: "12px",
                            display: "grid",
                            placeItems: "center",
                            background: "var(--panel-2)",
                          }}
                        >
                          Image unavailable
                        </div>
                      )}
                      <span className="variation-modal-card-badge">Option {v.variation_id}</span>
                    </div>
                    <div className="variation-modal-card-body">
                      <p className="variation-modal-tags">Tone: {v.tone_applied}</p>
                      <p className="variation-modal-card-text">{v.text}</p>
                      <p className="variation-modal-tags">{v.hashtags.join(" ")}</p>

                      <div className="variation-modal-card-actions">
                        <button
                          type="button"
                          className="btn primary variation-modal-select"
                          disabled={busy || !canPersist}
                          title={!canPersist ? "Selection requires a persisted draft post id." : undefined}
                          onClick={() => onSelect(v)}
                        >
                          {busy ? "Saving…" : "Use this variant"}
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
                            <span className="variation-modal-rework-title">
                              Edit and regenerate option {v.variation_id}
                            </span>
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
              })
            : null}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
