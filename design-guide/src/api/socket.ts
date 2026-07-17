export type SocketAuthPayload = {
  token?: string;
  bypass?: boolean;
  bypassSecret?: string;
};

function readRaw(key: string): string {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

export function getSocketUrl(): string {
  const override = readRaw("VITE_SOCKET_URL");
  if (override) return override.replace(/\/+$/, "");
  const apiBase = readRaw("VITE_API_BASE_URL") || "http://localhost:3001";
  return apiBase.replace(/\/+$/, "");
}

export function buildSocketAuthPayload(): SocketAuthPayload {
  let token = "";
  try {
    token = localStorage.getItem("authToken")?.trim() ?? "";
  } catch {
    token = "";
  }
  const auth = token ? { token } : {};
  const bypassRaw = readRaw("VITE_SOCKET_BYPASS").toLowerCase();
  const bypass = bypassRaw === "true" || bypassRaw === "1" || bypassRaw === "yes";
  if (!bypass) return auth;
  const bypassSecret = readRaw("VITE_SOCKET_BYPASS_SECRET");
  return {
    ...auth,
    bypass: true,
    ...(bypassSecret ? { bypassSecret } : {}),
  };
}
