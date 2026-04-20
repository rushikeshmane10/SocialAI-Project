import { useCallback, useState } from "react";
import { sendSatisfactionSignalFireAndForget, type SatisfactionLevel } from "../api/satisfaction";

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
      <p className="meta" role="status">
        Thanks for the feedback.
      </p>
    );
  }

  return (
    <div className="card animate-in">
      <p className="meta">Was this close to what you wanted?</p>
      <div className="row end">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="btn ghost"
            onClick={() => handlePick(opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <button type="button" className="btn muted" onClick={dismiss}>
          skip
        </button>
      </div>
    </div>
  );
}
