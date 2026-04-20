import { randomUUID } from "node:crypto";

export function requestIdMiddleware(req, res, next) {
  const headerId = req.headers["x-request-id"];
  req.requestId =
    typeof headerId === "string" && headerId.length > 0 ? headerId : randomUUID();
  next();
}
