import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Context ─────────────────────────────────────────────────────────────── */

type LoadingContextValue = {
  isLoading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
  /** Wrap any async fn: shows loader before, hides after (even on error) */
  withLoader: <T>(fn: () => Promise<T>) => Promise<T>;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const showLoader = useCallback(() => setCount((c) => c + 1), []);
  const hideLoader = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  const withLoader = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setCount((c) => c + 1);
      try {
        return await fn();
      } finally {
        setCount((c) => Math.max(0, c - 1));
      }
    },
    [],
  );

  const value = useMemo<LoadingContextValue>(
    () => ({ isLoading: count > 0, showLoader, hideLoader, withLoader }),
    [count, showLoader, hideLoader, withLoader],
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <LoadingOverlay visible={count > 0} />
    </LoadingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}

/* ─── Animated Overlay ────────────────────────────────────────────────────── */

function LoadingOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
          aria-live="assertive"
          aria-label="Loading"
          role="status"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/60" />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-10 py-9 shadow-[var(--shadow-modal)]"
          >
            {/* Spinner ring */}
            <SpinnerRing />

            <p className="font-heading text-[15px] font-semibold tracking-tight text-foreground">
              Just a moment…
            </p>
            <p className="text-xs text-muted-foreground">Processing your request</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */

function SpinnerRing() {
  return (
    <div className="relative h-14 w-14">
      {/* Gradient track */}
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 56 56"
        fill="none"
        aria-hidden
      >
        <circle
          cx="28"
          cy="28"
          r="23"
          stroke="currentColor"
          strokeWidth="4"
          className="text-border"
        />
        <circle
          cx="28"
          cy="28"
          r="23"
          stroke="url(#spinner-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="144"
          strokeDashoffset="108"
          className="origin-center animate-[spin_0.9s_linear_infinite]"
          style={{ transformOrigin: "28px 28px" }}
        />
        <defs>
          <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff7a18" />
            <stop offset="40%" stopColor="#ff4d8d" />
            <stop offset="70%" stopColor="#7b61ff" />
            <stop offset="100%" stopColor="#635bff" />
          </linearGradient>
        </defs>
      </svg>

      {/* Pulsing dot center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="h-2.5 w-2.5 rounded-full bg-[image:var(--gradient-primary)] opacity-80"
          style={{ animation: "pulse 1.4s ease-in-out infinite" }}
        />
      </div>
    </div>
  );
}
