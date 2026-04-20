import { z } from "zod";

export const listPostsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const selectVariationBodySchema = z.object({
  variation_id: z.coerce.number().int().refine((n) => n === 1 || n === 2, {
    message: "variation_id must be 1 or 2",
  }),
  selected_text: z.string().trim().min(1).max(500),
});
