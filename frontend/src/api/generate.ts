import type { MockGenerateResponse, SelectVariationResponse } from "../types/generate";
import { postJson } from "./client";

export type GenerateMockPostsBody = {
  topic: string;
  tone: string;
  reworkBaseText?: string;
  reworkInstructions?: string;
  /** When reworking, the draft post id that contained the base variation (stored in post_rework_logs.source_post_id). */
  sourcePostId?: string;
  /** Option 1 or 2 being refined — stored with rework logs, not used in tweet text. */
  sourceVariationId?: number;
};

export async function generateMockPosts(body: GenerateMockPostsBody): Promise<MockGenerateResponse> {
  return postJson<MockGenerateResponse>("/ai/generate", body);
}

export async function selectPostVariation(
  postId: string,
  body: { variation_id: 1 | 2; selected_text: string },
): Promise<SelectVariationResponse> {
  return postJson<SelectVariationResponse>(`/posts/${encodeURIComponent(postId)}/select-variation`, body);
}
