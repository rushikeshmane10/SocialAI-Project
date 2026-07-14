import { motion } from "framer-motion";
import { Sparkles, Send } from "lucide-react";

type Props = {
  /** Post body — same string as the composer after picking a variant */
  text: string;
  /** Tone label from the chosen variation (e.g. professional) */
  toneLabel: string | null;
  loading: boolean;
  onSubmit: () => void;
};

export function SelectedPostDevicePreview({ text, toneLabel, loading, onSubmit }: Props) {
  const charCount = text.length;
  const isOver = charCount > 280;

  return (
    <div className="relative flex flex-col items-center">
      <p className="mb-4 text-center font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Your selection
      </p>

      <motion.div
        className="relative w-full max-w-[320px] origin-center will-change-transform"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        whileHover={{
          scale: 1.035,
          y: -4,
          transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-primary/25 opacity-70 blur-3xl dark:bg-primary/35"
        />

        <div className="relative rounded-[2.35rem] bg-linear-to-b from-zinc-800 via-zinc-900 to-zinc-950 p-[11px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.06)_inset] dark:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.08)_inset]">
          <div className="overflow-hidden rounded-[1.85rem] border border-white/10 bg-card shadow-inner">
            <div className="flex h-8 items-end justify-center pb-1.5 pt-2">
              <div className="h-1.5 w-16 rounded-full bg-foreground/10" />
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/25 px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Live preview
              </span>
              <span
                className={`tabular-nums text-[11px] font-bold ${isOver ? "text-destructive" : "text-muted-foreground"}`}
              >
                {charCount}/280
              </span>
            </div>

            <div className="min-h-[140px] max-h-[280px] overflow-y-auto px-4 py-4">
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed tracking-[-0.01em] text-card-foreground">
                {text}
              </p>
            </div>

            {toneLabel ? (
              <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5">
                <span className="inline-flex rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground shadow-sm backdrop-blur-sm">
                  Tone · {toneLabel}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          Matches your composer on the left — review, edit if needed, then publish.
        </p>

        <motion.button
          type="button"
          disabled={loading}
          onClick={onSubmit}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
          transition={{ duration: 0.2 }}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/35 transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/45 disabled:opacity-45"
        >
          {loading ? (
            <span className="tracking-wide">Publishing…</span>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Post to X
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
