import { postJson } from "./client";

export type SatisfactionLevel = "yes" | "almost" | "not_really";

/**
 * Fire-and-forget: never throws; failures are silent (non-blocking UX).
 */
export function sendSatisfactionSignalFireAndForget(postId: string, signal: SatisfactionLevel): void {
  void postJson<{ success: boolean; signal_id?: string; signal: string; duplicate?: boolean }>(
    `/posts/${encodeURIComponent(postId)}/satisfaction`,
    { signal },
  ).catch(() => {});
}
