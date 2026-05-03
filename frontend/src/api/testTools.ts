import { postJson } from "./client";

export type LinkedinImagePostTestResponse = {
  success: boolean;
  linkedInPostId?: string | null;
  s3key?: string;
  author?: string;
  error?: {
    code?: string;
    message?: string;
  };
  [key: string]: unknown;
};

// TEST ONLY: calls backend test endpoint for LinkedIn image publishing via Composio.
export async function runLinkedinImagePostTest(): Promise<LinkedinImagePostTestResponse> {
  return postJson<LinkedinImagePostTestResponse>("/test/linkedin-image-post", {});
}
