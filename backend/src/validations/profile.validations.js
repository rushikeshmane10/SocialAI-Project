import { z } from "zod";

export const profileUpsertBodySchema = z.object({
  profession: z.string().trim().max(500),
  audience: z.string().trim().max(500),
  vibe: z.string().trim().max(500),
});
