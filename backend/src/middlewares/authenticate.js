import { apiErrorBody } from "../utils/response.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function headerUserId(req) {
  const raw = req.headers["x-user-id"];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && raw[0]) return String(raw[0]).trim();
  return "";
}

export function requireUserId(req, res, next) {
  const id = headerUserId(req);
  if (!id || !UUID_RE.test(id)) {
    return res.status(401).json(apiErrorBody("UNAUTHORIZED", "Authentication required"));
  }
  req.userId = id;
  next();
}

export function getUserId(req) {
  const id = req.userId;
  if (!id) {
    throw new Error("userId missing; requireUserId must run first");
  }
  return id;
}
