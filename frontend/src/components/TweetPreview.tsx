import type { ReactNode } from "react";

type Props = {
  draft: string;
  actions?: ReactNode;
};

const MAX = 280;

export function TweetPreview({ draft, actions }: Props) {
  const len = [...draft].length;
  const over = len > MAX;
  return (
    <article className="card animate-in">
      <div className="card-label">Preview</div>
      <pre className="preview">{draft || "—"}</pre>
      <div className="row spread tweet-preview-footer">
        <span className={over ? "count bad" : "count"}>
          {len}/{MAX}
        </span>
        {actions ?? null}
      </div>
    </article>
  );
}
