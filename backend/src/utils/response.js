export function apiErrorBody(code, message, details) {
  const error = { code, message };
  if (details !== undefined) {
    error.details = details;
  }
  return { error };
}

export function sendApiError(res, status, code, message, details) {
  return res.status(status).json(apiErrorBody(code, message, details));
}
