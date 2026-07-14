import { Composio } from "@composio/core";
import sharp from "sharp";
import { composioConfigured, env } from "../config/env.js";

export class ComposioServiceError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = "ComposioServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const PLATFORM_TO_APP = Object.freeze({
  twitter: "twitter",
  linkedin: "linkedin",
});

const PLATFORM_TO_COLUMN = Object.freeze({
  twitter: "twitter_connected",
  linkedin: "linkedin_connected",
});

let cachedClient = null;

function getClient() {
  if (!composioConfigured()) {
    throw new ComposioServiceError(
      "Composio is not configured. Set COMPOSIO_API_KEY in the backend environment.",
      503,
      "COMPOSIO_NOT_CONFIGURED",
    );
  }
  if (!cachedClient) {
    cachedClient = new Composio({ apiKey: env.COMPOSIO_API_KEY });
  }
  return cachedClient;
}

function appNameFor(platform) {
  const appName = PLATFORM_TO_APP[platform];
  if (!appName) {
    throw new ComposioServiceError(
      `Unsupported platform: ${platform}. Expected "twitter" or "linkedin".`,
      400,
      "COMPOSIO_INVALID_PLATFORM",
    );
  }
  return appName;
}

/**
 * Returns the authConfigId for the given platform, or throws a clear error if
 * the env var is missing.
 * @param {"twitter" | "linkedin"} platform
 * @returns {string}
 */
function getAuthConfigId(platform) {
  if (platform === "linkedin") {
    const id = (env.COMPOSIO_LINKEDIN_AUTHOR_URN || "").trim();
    if (!id) {
      throw new ComposioServiceError(
        "COMPOSIO_LINKEDIN_AUTHOR_URN is not set. Add it to your backend environment.",
        503,
        "COMPOSIO_NOT_CONFIGURED",
      );
    }
    return id;
  }

  if (platform === "twitter") {
    const id = (env.COMPOSIO_TWITTER_AUTH_CONFIG_ID || "").trim();
    if (!id) {
      throw new ComposioServiceError(
        "COMPOSIO_TWITTER_AUTH_CONFIG_ID is not set. Add it to your backend environment.",
        503,
        "COMPOSIO_NOT_CONFIGURED",
      );
    }
    return id;
  }

  throw new ComposioServiceError(
    `Unsupported platform: ${platform}. Expected "twitter" or "linkedin".`,
    400,
    "COMPOSIO_INVALID_PLATFORM",
  );
}

function wrapSdkError(err, fallbackMessage) {
  if (err instanceof ComposioServiceError) return err;
  return new ComposioServiceError(fallbackMessage, 502, "COMPOSIO_ERROR");
}

/**
 * @param {string} userId
 * @param {"twitter" | "linkedin"} platform
 * @returns {Promise<{ redirectUrl: string, connectionId: string | null, waitForConnection: (timeoutMs?: number) => Promise<unknown> }>}
 */
export async function getConnectionUrl(userId, platform) {
  const authConfigId = getAuthConfigId(platform);
  const client = getClient();

  try {
    const connectionRequest = await client.connectedAccounts.link(userId, authConfigId);
    const redirectUrl = connectionRequest?.redirectUrl || connectionRequest?.redirect_url || null;

    if (!redirectUrl) {
      throw new ComposioServiceError(
        `Composio did not return a redirect URL for ${platform}. Verify the auth config ID and that the app is configured for OAuth.`,
        502,
        "COMPOSIO_MISSING_REDIRECT_URL",
      );
    }

    return {
      redirectUrl,
      connectionId: connectionRequest?.id || null,
      waitForConnection: async (timeoutMs = 120_000) => {
        if (typeof connectionRequest?.waitForConnection === "function") {
          return connectionRequest.waitForConnection(timeoutMs);
        }
        if (typeof client.connectedAccounts?.waitForConnection === "function" && connectionRequest?.id) {
          return client.connectedAccounts.waitForConnection(connectionRequest.id, timeoutMs);
        }
        throw new ComposioServiceError(
          `Composio did not expose a waitForConnection method for ${platform}.`,
          502,
          "COMPOSIO_CONNECTION_WAIT_FAILED",
        );
      },
    };
  } catch (err) {
    console.error("Composio connection error:", err?.message ?? err);
    throw wrapSdkError(err, `Could not initiate ${platform} connection.`);
  }
}

/**
 * @param {string} userId
 * @param {"twitter" | "linkedin"} platform
 * @returns {Promise<boolean>} True when Composio reports an ACTIVE connection.
 */
export async function isConnected(userId, platform) {
  const client = getClient();
  const toolkitSlug = platform === "linkedin" ? "linkedin" : "twitter";
  try {
    const result = await client.connectedAccounts.list({
      userIds: [userId],
      toolkitSlugs: [toolkitSlug],
      statuses: ["ACTIVE"],
    });
    return Array.isArray(result?.items) && result.items.length > 0;
  } catch (err) {
    throw wrapSdkError(err, `Could not read ${platform} connection status.`);
  }
}

/**
 * Persist a successful OAuth connection on the users row. Caller must pass the loaded
 * Sequelize User instance to avoid an extra round-trip and to keep this layer thin.
 * @param {string} userId
 * @param {"twitter" | "linkedin"} platform
 * @param {import("sequelize").Model} sequelizeUserInstance
 * @returns {Promise<void>}
 */
export async function saveConnectionStatus(userId, platform, sequelizeUserInstance) {
  const column = PLATFORM_TO_COLUMN[platform];
  if (!column) {
    throw new ComposioServiceError(
      `Unsupported platform: ${platform}. Expected "twitter" or "linkedin".`,
      400,
      "COMPOSIO_INVALID_PLATFORM",
    );
  }
  if (!sequelizeUserInstance) {
    throw new ComposioServiceError(
      "User row is required to save Composio connection status.",
      500,
      "COMPOSIO_ERROR",
    );
  }
  sequelizeUserInstance.set(column, true);
  sequelizeUserInstance.set("composio_entity_id", userId);
  try {
    await sequelizeUserInstance.save();
  } catch (err) {
    throw wrapSdkError(err, `Could not persist ${platform} connection status.`);
  }
}

/** @param {{ successful?: boolean; successfull?: boolean } | undefined} response */
function actionSucceeded(response) {
  return (
    response?.successful === true ||
    /** @type {{ successfull?: boolean }} */ (response)?.successfull === true
  );
}

/**
 * @param {unknown} data
 * @returns {Record<string, unknown>}
 */
function normalizeActionData(data) {
  if (data == null || data === "") return {};
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
    return /** @type {Record<string, unknown>} */ (data[0]);
  }
  if (typeof data === "object" && !Array.isArray(data)) {
    return /** @type {Record<string, unknown>} */ (data);
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null) {
        return /** @type {Record<string, unknown>} */ (parsed[0]);
      }
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return /** @type {Record<string, unknown>} */ (parsed);
      }
    } catch {
      return {};
    }
  }
  return {};
}

/** @param {string} s */
function extractPersonUrnFromString(s) {
  if (typeof s !== "string" || !s) return null;
  const m = s.match(/urn:li:person:[A-Za-z0-9_-]+/);
  return m ? m[0] : null;
}

/**
 * Walk nested objects/arrays for a person URN substring (Composio often nests LinkedIn payloads).
 * @param {unknown} node
 * @param {number} depth
 * @returns {string | null}
 */
function findPersonUrnDeep(node, depth = 0) {
  if (depth > 14 || node == null) return null;
  if (typeof node === "string") {
    return extractPersonUrnFromString(node);
  }
  if (typeof node === "number" || typeof node === "boolean") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const u = findPersonUrnDeep(item, depth + 1);
      if (u) return u;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const k of Object.keys(node)) {
      const u = findPersonUrnDeep(/** @type {Record<string, unknown>} */(node)[k], depth + 1);
      if (u) return u;
    }
  }
  return null;
}


/**
 * @param {Record<string, unknown>} obj
 * @returns {string | null}
 */
function scalarToTrimmedString(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v).trim();
  return "";
}

function linkedInPersonUrnFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  const keys = [
    "id",
    "sub",
    "member_id",
    "personId",
    "entityUrn",
    "personUrn",
    "memberUrn",
    "userId",
    "linkedinId",
    "person_id",
  ];
  for (const k of keys) {
    const t = scalarToTrimmedString(obj[k]);
    if (!t) continue;
    if (t.startsWith("urn:li:person:")) return t;
  }
  for (const k of keys) {
    const t = scalarToTrimmedString(obj[k]);
    if (!t || t.startsWith("urn:")) continue;
    if (!t.includes(" ") && t.length > 0 && t.length < 256) {
      return `urn:li:person:${t}`;
    }
  }
  const profile = obj.profile;
  if (profile && typeof profile === "object" && !Array.isArray(profile)) {
    const nested = linkedInPersonUrnFromObject(/** @type {Record<string, unknown>} */(profile));
    if (nested) return nested;
  }
  return null;
}

/**
 * @param {unknown} rawFromExecute
 * @returns {string | null}
 */
function resolveLinkedInAuthorUrnFromGetMyInfoData(rawFromExecute) {
  const blob =
    typeof rawFromExecute === "string" ? rawFromExecute : JSON.stringify(rawFromExecute ?? {});
  const fromRegex = extractPersonUrnFromString(blob);
  if (fromRegex) return fromRegex;

  let urn = findPersonUrnDeep(rawFromExecute);
  if (urn) return urn;

  const root = normalizeActionData(rawFromExecute);
  const candidates = [root];
  const wrapperKeys = ["data", "response", "result", "body", "output", "payload", "linkedin", "profile"];
  for (const k of wrapperKeys) {
    const inner = root[k];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      candidates.push(/** @type {Record<string, unknown>} */(inner));
    } else if (typeof inner === "string" && inner.trim().startsWith("{")) {
      candidates.push(normalizeActionData(inner));
    }
  }
  for (const obj of candidates) {
    urn = linkedInPersonUrnFromObject(obj);
    if (urn) return urn;
  }
  for (const obj of candidates) {
    urn = findPersonUrnDeep(obj);
    if (urn) return urn;
  }
  return null;
}

/**
 * @param {import("@composio/core").Composio} client
 * @param {string} userId
 * @returns {Promise<string>}
 */
async function fetchLinkedInAuthorUrn(client, userId) {
  const manual = (env.COMPOSIO_LINKEDIN_AUTHOR_URN || "").trim();
  if (manual.startsWith("urn:li:person:")) {
    return manual;
  }

  let info;
  try {
    info = await client.tools.execute("LINKEDIN_GET_MY_INFO", { userId, arguments: {} });
  } catch {
    throw new ComposioServiceError(
      "Could not load LinkedIn profile for posting.",
      502,
      "COMPOSIO_POST_FAILED",
    );
  }
  if (!actionSucceeded(info)) {
    const detail =
      typeof info?.error === "string" && info.error.length > 0 ? info.error : "LinkedIn Get My Info failed.";
    throw new ComposioServiceError(detail, 502, "COMPOSIO_POST_FAILED");
  }
  const urn = resolveLinkedInAuthorUrnFromGetMyInfoData(info.data);
  if (!urn) {
    throw new ComposioServiceError(
      "Could not resolve LinkedIn author URN from profile response. Check LinkedIn scopes (w_member_social) and Composio LINKEDIN_GET_MY_INFO payload shape.",
      502,
      "COMPOSIO_POST_FAILED",
    );
  }
  return urn;
}

/** @param {string | null | undefined} raw */
function linkedInHasImageInput(raw) {
  return typeof raw === "string" && raw.trim().replace(/\s/g, "").length > 0;
}

/**
 * Strip optional data-URL prefix; return raw base64 payload.
 * @param {string} raw
 * @returns {string}
 */
function parseDataUrlBase64(raw) {
  const compact = raw.trim().replace(/\s/g, "");
  const m = /^data:([^;]+);base64,(.+)$/i.exec(compact);
  return m ? m[2] : compact;
}

/**
 * Decode AI-provided base64 / data URL and compress to JPEG within env limits.
 * @param {string} raw
 * @returns {Promise<{ buffer: Buffer }>}
 */
async function decodeAndCompressLinkedInImage(raw) {
  const payload = parseDataUrlBase64(raw);
  if (!payload) {
    throw new ComposioServiceError("Empty image payload.", 400, "LINKEDIN_IMAGE_PREP_FAILED");
  }
  let buf;
  try {
    buf = Buffer.from(payload, "base64");
  } catch {
    throw new ComposioServiceError("Invalid image base64.", 400, "LINKEDIN_IMAGE_PREP_FAILED");
  }
  if (buf.length === 0) {
    throw new ComposioServiceError("Invalid image base64.", 400, "LINKEDIN_IMAGE_PREP_FAILED");
  }

  const maxBytes = env.COMPOSIO_LINKEDIN_IMAGE_MAX_BYTES;
  const maxEdge = env.COMPOSIO_LINKEDIN_IMAGE_MAX_EDGE;
  let quality = env.COMPOSIO_LINKEDIN_IMAGE_JPEG_QUALITY_START;
  let edge = maxEdge;

  try {
    for (let attempt = 0; attempt < 48; attempt += 1) {
      const out = await sharp(buf)
        .rotate()
        .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (out.length <= maxBytes) {
        return { buffer: out };
      }
      if (quality > 45) {
        quality -= 5;
      } else {
        edge = Math.max(256, Math.floor(edge * 0.88));
      }
    }
  } catch {
    throw new ComposioServiceError("Could not process image for LinkedIn.", 400, "LINKEDIN_IMAGE_PREP_FAILED");
  }
  throw new ComposioServiceError("Could not compress image under max bytes.", 400, "LINKEDIN_IMAGE_PREP_FAILED");
}

/** @param {string | undefined} text */
function isImageSchemaValidationError(text) {
  if (typeof text !== "string" || text.trim().length === 0) return false;
  return /(invalid|validation|schema|required|must|type|expected|images)/i.test(text);
}

/**
 * @param {unknown} rawUploadData
 * @returns {{ uploadUrl: string | null, assetUrn: string | null }}
 */
function extractLinkedInUploadMetadata(rawUploadData) {
  const root = normalizeActionData(rawUploadData);
  const candidates = [root];
  const wrapperKeys = ["data", "response", "result", "body", "output", "payload"];
  for (const key of wrapperKeys) {
    const inner = root[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      candidates.push(/** @type {Record<string, unknown>} */(inner));
    } else if (typeof inner === "string" && inner.trim().startsWith("{")) {
      const parsed = normalizeActionData(inner);
      if (Object.keys(parsed).length > 0) candidates.push(parsed);
    }
  }

  for (const candidate of candidates) {
    const uploadUrl =
      typeof candidate === "object" && candidate !== null
        ? (() => {
          for (const key of ["upload_url", "uploadUrl", "uploadURL", "presignedUploadUrl"]) {
            const value = /** @type {Record<string, unknown>} */ (candidate)[key];
            if (typeof value === "string" && value.trim().length > 0) return value.trim();
          }
          return null;
        })()
        : null;
    const assetUrn =
      typeof candidate === "object" && candidate !== null
        ? (() => {
          for (const key of ["asset_urn", "assetUrn", "assetURN", "digitalMediaAssetUrn"]) {
            const value = /** @type {Record<string, unknown>} */ (candidate)[key];
            if (typeof value === "string" && value.trim().length > 0) return value.trim();
          }
          return null;
        })()
        : null;
    if (uploadUrl || assetUrn) {
      return { uploadUrl, assetUrn };
    }
  }

  return { uploadUrl: null, assetUrn: null };
}

/**
 * @param {string} uploadUrl
 * @param {Buffer} imageBuffer
 * @returns {Promise<void>}
 */
async function uploadImageBytesToLinkedIn(uploadUrl, imageBuffer) {
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
    },
    body: imageBuffer,
  });

  if (!uploadResponse.ok) {
    throw new ComposioServiceError(
      `LinkedIn image upload failed with status ${uploadResponse.status}`,
      502,
      "COMPOSIO_POST_FAILED",
    );
  }
}

/**
 * @param {string} author
 * @param {string} text
 * @param {string[] | null} imageAssetUrns
 */
function buildLinkedInCreatePostParams(author, text, imageAssetUrns) {
  /** @type {Record<string, unknown>} */
  const params = {
    author,
    commentary: text,
    visibility: "PUBLIC",
    lifecycleState: "PUBLISHED",
  };
  if (Array.isArray(imageAssetUrns) && imageAssetUrns.length > 0) {
    params.images = imageAssetUrns;
  }
  return params;
}

/**
 * @param {import("@composio/core").Composio} client
 * @param {string} userId
 * @param {string} author
 * @param {string} text
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ successful?: boolean; error?: string | null; data?: Record<string, unknown> }>}
 */
async function createLinkedInPostWithImageUpload(client, userId, author, text, imageBuffer) {
  const uploadRegistration = await client.tools.execute("LINKEDIN_REGISTER_IMAGE_UPLOAD", {
    userId,
    arguments: {
      owner_urn: author,
      recipe: "urn:li:digitalmediaRecipe:feedshare-image",
      supported_upload_mechanism: ["SYNCHRONOUS_UPLOAD"],
    },
  });

  if (!actionSucceeded(uploadRegistration)) {
    const detail =
      typeof uploadRegistration?.error === "string" && uploadRegistration.error.length > 0
        ? uploadRegistration.error
        : "LinkedIn image registration failed.";
    throw new ComposioServiceError(detail, 502, "COMPOSIO_POST_FAILED");
  }

  const { uploadUrl, assetUrn } = extractLinkedInUploadMetadata(uploadRegistration.data);
  if (!uploadUrl || !assetUrn) {
    throw new ComposioServiceError(
      "LinkedIn image registration did not return an upload URL and asset URN.",
      502,
      "COMPOSIO_POST_FAILED",
    );
  }

  await uploadImageBytesToLinkedIn(uploadUrl, imageBuffer);
  return client.tools.execute("LINKEDIN_CREATE_LINKED_IN_POST", {
    userId,
    arguments: buildLinkedInCreatePostParams(author, text, [assetUrn]),
  });
}

/**
 * @param {Record<string, unknown> | undefined} data
 * @returns {string | undefined}
 */
function extractExternalPostId(data) {
  if (!data || typeof data !== "object") return undefined;
  const d = /** @type {Record<string, unknown>} */ (data);
  for (const key of ["id", "postId", "post_id", "tweet_id", "tweetId", "activity_urn", "urn"]) {
    const v = d[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * Posts text (and optional LinkedIn image) via Composio SDK.
 * Text-only: LINKEDIN_GET_MY_INFO (author) + LINKEDIN_CREATE_LINKED_IN_POST.
 * With image: same author resolution + write temp file + LINKEDIN_CREATE_LINKED_IN_POST
 * with local image path (retrying one alternate path object shape on schema-like errors).
 * @param {string} userId
 * @param {"linkedin" | "twitter"} platform
 * @param {string} text
 * @param {string | null | undefined} [imageBase64] LinkedIn: `selected_image_base64` (data URL or raw base64).
 * @returns {Promise<{ success: true, postId?: string }>}
 */
export async function executePost(userId, platform, text, imageBase64 = null) {
  if (platform !== "linkedin" && platform !== "twitter") {
    throw new ComposioServiceError(
      `Unsupported platform: ${platform}. Expected "twitter" or "linkedin".`,
      400,
      "COMPOSIO_INVALID_PLATFORM",
    );
  }
  const client = getClient();
  let response;
  try {
    if (platform === "linkedin") {
      const author = await fetchLinkedInAuthorUrn(client, userId);
      if (!linkedInHasImageInput(imageBase64)) {
        response = await client.tools.execute("LINKEDIN_CREATE_LINKED_IN_POST", {
          userId,
          arguments: buildLinkedInCreatePostParams(author, text, null),
        });
      } else {
        try {
          const { buffer: imageBuf } = await decodeAndCompressLinkedInImage(
            /** @type {string} */(imageBase64),
          );
          response = await createLinkedInPostWithImageUpload(client, userId, author, text, imageBuf);
        } catch (prepErr) {
          if (prepErr instanceof ComposioServiceError) throw prepErr;
          throw new ComposioServiceError("Could not prepare image for LinkedIn.", 400, "LINKEDIN_IMAGE_PREP_FAILED");
        }
      }
    } else {
      response = await client.tools.execute("TWITTER_CREATE_TWEET", {
        userId,
        arguments: { text },
      });
    }
  } catch (err) {
    if (err instanceof ComposioServiceError) throw err;
    throw new ComposioServiceError(
      "Could not publish post via Composio.",
      502,
      "COMPOSIO_POST_FAILED",
    );
  }
  const ok = actionSucceeded(response);
  if (!ok) {
    const detail =
      typeof response?.error === "string" && response.error.length > 0
        ? response.error
        : "Composio action did not succeed.";
    throw new ComposioServiceError(detail, 502, "COMPOSIO_POST_FAILED");
  }
  const externalId = extractExternalPostId(normalizeActionData(response.data));
  return externalId ? { success: true, postId: externalId } : { success: true };
}

/**
 * TEST ONLY: `POST /test/linkedin-image-post` — same Composio path as production LinkedIn publish.
 * Optional `COMPOSIO_TEST_IMAGE_BASE64` (raw or data URL) attaches an image.
 * @param {string} entityId Composio entity id (see `COMPOSIO_ENTITY_ID`).
 * @returns {Promise<{ success: true, postId?: string }>}
 */
export async function testLinkedinImagePostViaComposio(entityId) {
  const testImage =
    typeof process.env.COMPOSIO_TEST_IMAGE_BASE64 === "string" ? process.env.COMPOSIO_TEST_IMAGE_BASE64 : null;
  return executePost(
    entityId,
    "linkedin",
    "Test post (SociaAI /test/linkedin-image-post)",
    testImage,
  );
}
