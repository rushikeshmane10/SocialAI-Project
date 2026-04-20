/**
 * Simple heuristics over recent feedback (no ML). Used to refresh user_profiles.dynamic_adjustments.
 * @param {('accepted' | 'rejected' | 'edited' | 'regenerated')[]} actions
 */
export function computeDynamicAdjustments(actions) {
  const counts = { accepted: 0, rejected: 0, edited: 0, regenerated: 0 };
  for (const a of actions) {
    if (a === "accepted") counts.accepted++;
    else if (a === "rejected") counts.rejected++;
    else if (a === "edited") counts.edited++;
    else if (a === "regenerated") counts.regenerated++;
  }
  const total = Math.max(actions.length, 1);
  const signals = {
    accept_rate: counts.accepted / total,
    edit_rate: counts.edited / total,
    regenerate_rate: counts.regenerated / total,
    reject_rate: counts.rejected / total,
  };
  /** @type {Record<string, string>} */
  const hints = {};
  if (signals.edit_rate > 0.35) hints.conciseness = "prefer_shorter";
  if (signals.regenerate_rate > 0.3) hints.tone_stability = "high_regenerate_try_neutral";
  if (signals.accept_rate > 0.7) hints.reinforce = "current_style_ok";
  return {
    version: 1,
    computed_at: new Date().toISOString(),
    signals,
    hints,
  };
}
