import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

function bearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") return "";
  if (headerValue.toLowerCase().startsWith("bearer ")) {
    return headerValue.slice(7).trim();
  }
  return "";
}

export function socketAuth(socket, next) {
  const auth = socket.handshake.auth ?? {};
  const bypassEnabled = env.SOCKET_BYPASS_JWT === true;
  if (bypassEnabled) {
    const required = env.SOCKET_BYPASS_SECRET?.trim() ?? "";
    const supplied = typeof auth.bypassSecret === "string" ? auth.bypassSecret.trim() : "";
    if (required && supplied !== required) {
      return next(new Error("Unauthorized"));
    }
    socket.data.user = { sub: "bypass-user", isBypass: true, userId: null };
    return next();
  }

  const authToken = typeof auth.token === "string" ? auth.token.trim() : "";
  const headerToken = bearerToken(
    typeof socket.handshake.headers.authorization === "string" ? socket.handshake.headers.authorization : "",
  );
  const token = authToken || headerToken;
  if (!token) {
    return next(new Error("Unauthorized"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (!payload || typeof payload !== "object") {
      return next(new Error("Unauthorized"));
    }
    const sub = "sub" in payload && typeof payload.sub === "string" ? payload.sub : "";
    if (!sub) {
      return next(new Error("Unauthorized"));
    }
    socket.data.user = { ...payload, sub, isBypass: false, userId: sub };
    return next();
  } catch {
    return next(new Error("Unauthorized"));
  }
}
