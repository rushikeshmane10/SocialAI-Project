import { type ReactNode } from "react";

interface TweetPreviewProps {
  text: string;
  actions?: ReactNode;
}

export function TweetPreview({ text, actions }: TweetPreviewProps) {
  const charCount = text.length;
  const isOver = charCount > 280;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
        <span
          className={`text-xs tabular-nums font-semibold ${
            isOver ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {charCount}/280
        </span>
      </div>
      <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
        {text || <span className="text-muted-foreground/40">Your post will appear here…</span>}
      </div>
      {actions && <div className="mt-5 border-t border-border pt-5">{actions}</div>}
    </div>
  );
}
