import { z } from "zod";

const maxAnswerKeys = 20;
const maxKeyLen = 64;
const maxValueLen = 2000;

export const preferencesLogBodySchema = z
  .object({
    answers: z.record(z.string().max(maxKeyLen), z.string().max(maxValueLen)),
  })
  .superRefine((data, ctx) => {
    const keys = Object.keys(data.answers);
    if (keys.length > maxAnswerKeys) {
      ctx.addIssue({
        code: "custom",
        message: `Too many answer keys (max ${maxAnswerKeys})`,
        path: ["answers"],
      });
    }
    for (const key of keys) {
      if (!key.trim()) {
        ctx.addIssue({ code: "custom", message: "Empty answer keys are not allowed", path: ["answers"] });
        break;
      }
    }
  });
