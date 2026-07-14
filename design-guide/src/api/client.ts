function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim().replace(/\/+$/, "");
  }
  return "http://localhost:3001";
}

const baseUrl = resolveApiBaseUrl();

function userIdHeaders(): Record<string, string> {
  try {
    const userId = localStorage.getItem("userId");
    return userId ? { "X-User-Id": userId } : {};
  } catch {
    return {};
  }
}

export type ApiError = {
  error: { code: string; message: string; details?: unknown };
};

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function mapError(json: unknown, res: Response): Error & { status: number; code: string } {
  const err = json as ApiError | null;
  const message =
    err?.error?.message ??
    (typeof json === "object" && json && "message" in json
      ? String((json as { message: unknown }).message)
      : `Request failed (${res.status})`);
  const code = err?.error?.code ?? "REQUEST_FAILED";
  const e = new Error(message) as Error & { status: number; code: string };
  e.status = res.status;
  e.code = code;
  return e;
}

type JsonRequestOptions = {
  /** When false, omit X-User-Id (e.g. login before a user id exists). Default true. */
  sendUserId?: boolean;
};

export async function getJson<T>(path: string, options?: JsonRequestOptions): Promise<T> {
  const sendUserId = options?.sendUserId !== false;
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { ...(sendUserId ? userIdHeaders() : {}) },
  });
  const json = await parseJson(res);
  if (!res.ok) {
    throw mapError(json, res);
  }
  return json as T;
}

export async function postJson<T>(
  path: string,
  body: unknown,
  options?: JsonRequestOptions,
): Promise<T> {
  const sendUserId = options?.sendUserId !== false;
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(sendUserId ? userIdHeaders() : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await parseJson(res);

  if (!res.ok) {
    throw mapError(json, res);
  }

  return json as T;
}

export async function publishPost(
  postId: string,
  platform: "linkedin" | "twitter",
): Promise<{ success: true; platform: string }> {
  return postJson<{ success: true; platform: string; postId?: string }>(
    `/connections/posts/${encodeURIComponent(postId)}/publish`,
    { platform },
  );
}
