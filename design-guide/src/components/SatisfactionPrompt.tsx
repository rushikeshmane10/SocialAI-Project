import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sendSatisfactionSignalFireAndForget, type SatisfactionLevel } from "@/api/satisfaction";

const OPTIONS: { value: SatisfactionLevel; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "almost", label: "Almost" },
  { value: "not_really", label: "Not really" },
];

type Props = {
  postId: string;
  onDone?: (signal: SatisfactionLevel | null) => void;
};

export function SatisfactionPrompt({ postId, onDone }: Props) {
  const [phase, setPhase] = useState<"ask" | "thanks" | "gone">("ask");

  const dismiss = useCallback(() => {
    setPhase("gone");
    onDone?.(null);
  }, [onDone]);

  const handlePick = useCallback(
    (signal: SatisfactionLevel) => {
      sendSatisfactionSignalFireAndForget(postId, signal);
      setPhase("thanks");
      window.setTimeout(() => {
        setPhase("gone");
        onDone?.(signal);
      }, 1200);
    },
    [postId, onDone],
  );

  if (phase === "gone") return null;

  if (phase === "thanks") {
    return (
      <p className="sr-only" role="status">
        Thanks for the feedback.
      </p>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <p className="text-sm font-semibold text-card-foreground">
          How close was this to what you wanted?
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handlePick(opt.value)}
              className="rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-[var(--shadow-sm)] transition-all hover:border-foreground/15 hover:text-foreground"
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={dismiss}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            skip
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
