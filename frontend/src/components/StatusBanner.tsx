type Props = {
  loading: boolean;
  phase: "idle" | "generating" | "posting" | "done";
  error: string | null;
  successUrl: string | null;
};

export function StatusBanner(props: Props) {
  const { loading, error, successUrl } = props;
  if (loading && !error) {
    return null;
  }

  let message = "";
  if (error) {
    message = error;
  } else if (successUrl) {
    message = "Posted successfully.";
  }

  if (!message) return null;

  return (
    <article className="card animate-in">
      <div className="card-label">Status</div>
      <div className={`banner ${error ? "error" : successUrl ? "ok" : ""}`} role="status">
        {message}
        {successUrl ? (
          <>
            {" "}
            <a href={successUrl} target="_blank" rel="noreferrer">
              Open tweet
            </a>
          </>
        ) : null}
      </div>
    </article>
  );
}
