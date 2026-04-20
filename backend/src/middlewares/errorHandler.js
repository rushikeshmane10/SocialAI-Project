import { ZodError } from "zod";
import { sendApiError } from "../utils/response.js";

/**
 * @param {Error & { statusCode?: number }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  req.log?.error({ err, requestId: req.requestId }, "request failed");

  if (err instanceof ZodError) {
    return sendApiError(res, 400, "VALIDATION_ERROR", "Invalid request", err.flatten());
  }

  const status = err.statusCode;
  if (status === 400) {
    return sendApiError(res, 400, "BAD_REQUEST", err.message || "Bad request");
  }

  if (status === 401 || status === 403) {
    return sendApiError(res, status, "FORBIDDEN", err.message || "Forbidden");
  }

  if (status === 504) {
    return sendApiError(res, 504, "AI_TIMEOUT", err.message || "Upstream timed out");
  }

  if (status === 502) {
    return sendApiError(res, 502, "AI_UPSTREAM", err.message || "AI service error");
  }

  return sendApiError(res, 500, "INTERNAL_ERROR", "Something went wrong");
}
