import { z } from "zod";

export const VALID_SIGNALS = ["yes", "almost", "not_really"];

export const satisfactionBodySchema = z.object({
  signal: z.enum(["yes", "almost", "not_really"]),
});
