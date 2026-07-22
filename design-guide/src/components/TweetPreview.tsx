import { ArrowRight } from "lucide-react";

interface TweetPreviewProps {
  text: string;
  actions?: React.ReactNode;
}

export function TweetPreview({ text, actions }: TweetPreviewProps) {
  const charCount = text.length;
  const isOver = charCount > 280;
  const isEmpty = !text;

  return (
    <div className="preview-card p-6">
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

      <div className="mt-4 min-h-[300px] flex flex-col">
        {isEmpty ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted" />
              <div className="space-y-1.5">
                <div className="w-24 h-3 bg-muted rounded" />
                <div className="w-32 h-2.5 bg-muted rounded" />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="w-full h-3.5 bg-muted rounded" />
              <div className="w-full h-3.5 bg-muted rounded" />
              <div className="w-4/5 h-3.5 bg-muted rounded" />
            </div>

            <div className="space-y-2 pt-3">
              <div className="w-full h-3.5 bg-muted rounded" />
              <div className="w-1/2 h-3.5 bg-muted rounded" />
            </div>

            <div className="w-full h-48 bg-muted rounded-xl mt-4" />
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-card-foreground">
            {text}
          </div>
        )}
      </div>

      <div className="mt-5 pt-5">
        {actions ?? (
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold py-3.5 text-sm hover:opacity-90 transition-opacity"
          >
            Post to social media
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}