import { z } from "zod";

export const generateTweetBodySchema = z
  .object({
    topic: z.string().trim().max(200),
    tones: z
      .array(z.string().trim().min(1).max(40))
      .length(2)
      .refine((tones) => new Set(tones).size === tones.length, {
        message: "Please choose two different tones",
      }),
    reworkBaseText: z.string().max(280).optional(),
    reworkInstructions: z.string().max(400).optional(),
    /** Draft post the user reworked from (must belong to the caller when DB persist is used). */
    sourcePostId: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.string().uuid().optional()),
    /** Which on-screen option (1 or 2) is being refined — required with rework so storage ties to that draft only. */
    sourceVariationId: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().int().min(1).max(2).optional(),
    ),
    modelProvider: z.enum(["openai", "groq", "ollama"]).optional(),
    modelName: z.string().trim().max(128).optional(),
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

const callbackMetaSchema = z
  .object({
    userId: z.string().uuid().nullable().optional(),
    topic: z.string().optional(),
    tones: z.array(z.string()).optional(),
    sourceRequestId: z.string().trim().min(1).optional(),
  })
  .strict();

const callbackErrorSchema = z
  .object({
    code: z.string().trim().min(1),
    message: z.string().trim().min(1),
    stage: z.string().trim().min(1).optional(),
  })
  .strict();

const callbackVariationSchema = z
  .object({
    variation_id: z.number().int(),
    text: z.string(),
    tone_applied: z.string().optional(),
    estimated_length: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    image_base64: z.string().nullable().optional(),
  })
  .strict();

const callbackSuccessResultSchema = z
  .object({
    postId: z.string().uuid().nullable().optional(),
    variations: z.array(callbackVariationSchema),
    model: z.string().nullable().optional(),
    pipeline: z.unknown().optional(),
  })
  .passthrough();

export const generateCompleteCallbackSchema = z.discriminatedUnion("status", [
  z
    .object({
      requestId: z.string().trim().min(1),
      status: z.literal("succeeded"),
      finishedAt: z.string().datetime({ offset: true }),
      result: callbackSuccessResultSchema,
      meta: callbackMetaSchema.optional(),
    })
    .strict(),
  z
    .object({
      requestId: z.string().trim().min(1),
      status: z.literal("failed"),
      finishedAt: z.string().datetime({ offset: true }),
      error: callbackErrorSchema,
      result: z.record(z.string(), z.unknown()).optional(),
      meta: callbackMetaSchema.optional(),
    })
    .strict(),
]);
