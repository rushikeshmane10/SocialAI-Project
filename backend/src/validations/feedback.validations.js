import { z } from "zod";

const actionEnum = z.enum(["accepted", "rejected", "edited", "regenerated"]);

export const postFeedbackBodySchema = z
  .object({
    action: actionEnum,
    editedText: z.string().max(280).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "edited" && (!data.editedText || !data.editedText.trim())) {
      ctx.addIssue({
        code: "custom",
        message: "editedText is required when action is edited",
        path: ["editedText"],
      });
    }
  });
