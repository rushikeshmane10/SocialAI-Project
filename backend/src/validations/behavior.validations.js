import { z } from "zod";

export const behaviorEventBodySchema = z.object({
  event_type: z.string().trim().min(1).max(120),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});
