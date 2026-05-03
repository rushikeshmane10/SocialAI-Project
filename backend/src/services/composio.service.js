import { Composio } from "composio-core";
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

function wrapSdkError(err, fallbackMessage) {
  if (err instanceof ComposioServiceError) return err;
  return new ComposioServiceError(fallbackMessage, 502, "COMPOSIO_ERROR");
}

/**
 * @param {string} userId
 * @param {"twitter" | "linkedin"} platform
 * @returns {Promise<string>} OAuth redirect URL the user must visit to authorize.
 */
export async function getConnectionUrl(userId, platform) {
  const appName = appNameFor(platform);
  const client = getClient();
  let connectionRequest;
  try {
    const entity = await client.getEntity(userId);
    connectionRequest = await entity.initiateConnection({ appName });
  } catch (err) {
    throw wrapSdkError(err, `Could not initiate ${platform} connection.`);
  }
  const redirectUrl = connectionRequest?.redirectUrl;
  if (typeof redirectUrl !== "string" || redirectUrl.length === 0) {
    throw new ComposioServiceError(
      `${platform} connection did not return a redirect URL.`,
      502,
      "COMPOSIO_ERROR",
    );
  }
  return redirectUrl;
}

/**
 * @param {string} userId
 * @param {"twitter" | "linkedin"} platform
 * @returns {Promise<boolean>} True when Composio reports an ACTIVE connection.
 */
export async function isConnected(userId, platform) {
  const appName = appNameFor(platform);
  const client = getClient();
  try {
    const entity = await client.getEntity(userId);
    const connection = await entity.getConnection({ app: appName });
    return connection?.status === "ACTIVE";
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
      const u = findPersonUrnDeep(/** @type {Record<string, unknown>} */ (node)[k], depth + 1);
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
    const nested = linkedInPersonUrnFromObject(/** @type {Record<string, unknown>} */ (profile));
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
      candidates.push(/** @type {Record<string, unknown>} */ (inner));
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

/** @param {import("composio-core").Entity} entity */
async function fetchLinkedInAuthorUrn(entity) {
  const manual = (env.COMPOSIO_LINKEDIN_AUTHOR_URN || "").trim();
  if (manual.startsWith("urn:li:person:")) {
    return manual;
  }

  let info;
  try {
    info = await entity.execute({ actionName: "LINKEDIN_GET_MY_INFO", params: {} });
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

/**
 * Normalize stored base64 for Composio `LINKEDIN_CREATE_LINKED_IN_POST` `images` array.
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
function normalizeImageForLinkedInPost(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.trim().replace(/\s/g, "");
  if (!t) return null;
  if (t.startsWith("data:image/")) return t;
  return `data:image/png;base64,${t}`;
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
 * Posts text (and optional LinkedIn image) via Composio SDK only — no direct LinkedIn REST calls.
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
    const entity = await client.getEntity(userId);
    if (platform === "linkedin") {
      const author = await fetchLinkedInAuthorUrn(entity);
      /** @type {Record<string, unknown>} */
      const params = {
        author,
        commentary: text,
        visibility: "PUBLIC",
        lifecycleState: "PUBLISHED",
      };
      const img = normalizeImageForLinkedInPost(imageBase64);
      if (img) {
        params.images = [img];
      }
      response = await entity.execute({
        actionName: "LINKEDIN_CREATE_LINKED_IN_POST",
        params,
      });
    } else {
      response = await entity.execute({
        actionName: "TWITTER_CREATE_TWEET",
        params: { text },
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
