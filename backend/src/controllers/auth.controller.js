import { loginUser } from "../services/auth.service.js";
import { apiErrorBody } from "../utils/response.js";
import { loginBodySchema } from "../validations/auth.validations.js";

export async function loginHandler(req, res) {
  const parsed = loginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  try {
    const result = await loginUser(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      return res.status(401).json(apiErrorBody("INVALID_CREDENTIALS", "Invalid email or password"));
    }
    return res.json({ userId: result.userId, email: result.email });
  } catch (err) {
    req.log?.error({ err }, "login database error");
    return res
      .status(503)
      .json(apiErrorBody("SERVICE_UNAVAILABLE", "Could not verify credentials. Check the database connection."));
  }
}
