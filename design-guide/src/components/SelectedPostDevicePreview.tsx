import { motion } from "framer-motion";
import { ImagePlus, Send, Sparkles } from "lucide-react";

type Props = {
  /** Post body — same string as the composer after picking a variant */
  text: string;
  /** Tone label from the chosen variation (e.g. professional) */
  toneLabel: string | null;
  /** Preview-only image data URL (not persisted) */
  imageSrc: string | null;
  loading: boolean;
  onSubmit: () => void;
};

export function SelectedPostDevicePreview({
  text,
  toneLabel,
  imageSrc,
  loading,
  onSubmit,
}: Props) {
  const charCount = text.length;
  const isOver = charCount > 280;

  return (
    <div className="flex w-full justify-center px-4">
    <motion.div
      className="w-full max-w-[340px]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <article
        className="overflow-hidden rounded-[20px] border border-[rgba(168,85,247,0.15)] bg-[#0e0d12] shadow-[0_8px_24px_rgba(168,85,247,0.10),0_2px_8px_rgba(0,0,0,0.4)]"
        aria-label="Live post preview"
      >
        {/* Header */}
        <header className="flex h-[48px] items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <div
              aria-hidden
              className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#a855f7] to-[#6366f1]"
            />
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a78bfa]">
              <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
              Live preview
            </span>
          </div>
          <span
            className={`shrink-0 text-[11px] tabular-nums ${isOver ? "text-red-400" : "text-[#6b7280]"}`}
          >
            {charCount}/280
          </span>
        </header>
   
        {/* Image — single consistent aspect ratio for both states, so nothing
            jumps when an image is added. 4:5 (portrait) reads more premium
            than a square at this small width. */}
        {imageSrc ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#131217]">
            <img
              src={imageSrc}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-60% to-[rgba(14,13,18,0.85)]"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 border-b border-dashed border-[rgba(168,85,247,0.25)] bg-[#131217]">
            <ImagePlus className="h-5 w-5 text-[#6b7280]" aria-hidden />
            <span className="text-[13px] text-[#6b7280]">Add an image</span>
          </div>
        )}
   
        {/* Caption — one clamp mechanism only (line-clamp), no competing
            max-height. Font sized down slightly to fit the narrower card
            without the text block dominating it. */}
        <div className="px-3.5 py-3.5">
          <p className="line-clamp-4 whitespace-pre-wrap text-[13.5px] leading-[1.5] text-[#e5e5e7]">
            {text}
          </p>
        </div>
   
        {/* Footer */}
        {toneLabel ? (
          <footer className="border-t border-[rgba(255,255,255,0.06)] px-3.5 py-2.5">
            <span className="inline-flex rounded-full bg-[rgba(255,255,255,0.05)] px-2.5 py-1 text-[10.5px] capitalize text-[#9ca3af]">
              Tone · {toneLabel}
            </span>
          </footer>
        ) : null}
      </article>
   
      <button
        type="button"
        disabled={loading}
        onClick={onSubmit}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-bold text-primary-foreground shadow-[0_4px_14px_rgba(168,85,247,0.22)] transition-opacity disabled:opacity-45"
      >
        {loading ? (
          <span className="tracking-wide">Publishing…</span>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Post to X
          </>
        )}
      </button>
    </motion.div>
  </div>
  );
}
