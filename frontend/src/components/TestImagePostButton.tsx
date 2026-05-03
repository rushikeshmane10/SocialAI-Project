import { useState } from "react";
import { runLinkedinImagePostTest } from "../api/testTools";

// TEST ONLY: standalone debug button for LinkedIn image post test.
export function TestImagePostButton() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setOk(null);
    setErr(null);
    try {
      const res = await runLinkedinImagePostTest();
      if (!res?.success) {
        throw new Error(res?.error?.message || "Image post test failed.");
      }
      const urn = typeof res.linkedInPostId === "string" && res.linkedInPostId ? res.linkedInPostId : "(no post id)";
      setOk(`Posted. LinkedIn id/URN: ${urn}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Image post test failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="test-image-post-widget" aria-live="polite">
      <button type="button" className="btn primary" onClick={() => void onClick()} disabled={busy}>
        {busy ? "Testing..." : "Test Image Post"}
      </button>
      {ok ? <p className="test-image-post-widget__ok">{ok}</p> : null}
      {err ? <p className="test-image-post-widget__err">{err}</p> : null}
    </div>
  );
}
