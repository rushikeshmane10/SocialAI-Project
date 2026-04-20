import { z } from "zod";

export const generateTweetBodySchema = z
  .object({
    topic: z.string().trim().max(200),
    tone: z.string().trim().max(40).optional(),
    reworkBaseText: z.string().max(280).optional(),
    reworkInstructions: z.string().max(400).optional(),
    /** Draft post the user reworked from (must belong to the caller when DB persist is used). */
    sourcePostId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional()),
    /** Which on-screen option (1 or 2) is being refined — required with rework so storage ties to that draft only. */
    sourceVariationId: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().int().min(1).max(2).optional(),
    ),
  })
  .superRefine((data, ctx) => {
    const ins = (data.reworkInstructions ?? "").trim();
    const base = (data.reworkBaseText ?? "").trim();
    const hasRework = ins.length >= 3;
    if (hasRework && base.length < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["reworkBaseText"],
        message: "Base draft is required when rework instructions are provided",
      });
    }
    if (hasRework && data.sourceVariationId !== 1 && data.sourceVariationId !== 2) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceVariationId"],
        message: "Which option you are refining is required (1 or 2) when sending rework instructions",
      });
    }
    if (!hasRework && data.topic.trim().length < 3) {
      ctx.addIssue({
        code: "custom",
        path: ["topic"],
        message: "Topic must be at least 3 characters",
      });
    }
  });

export const postTweetBodySchema = z.object({
  text: z.string().trim().min(1).max(280),
});
