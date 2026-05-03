import { getModels } from "../db/sequelize.js";
import { getUserId } from "../middlewares/authenticate.js";
import {
  ComposioServiceError,
  executePost,
  getConnectionUrl,
  isConnected,
  saveConnectionStatus,
} from "../services/composio.service.js";
import { apiErrorBody } from "../utils/response.js";

const SUPPORTED_PLATFORMS = new Set(["twitter", "linkedin"]);

function parsePlatform(req, res) {
  const raw = req.params?.platform;
  const platform = typeof raw === "string" ? raw.toLowerCase() : "";
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    res.status(400).json(
      apiErrorBody(
        "VALIDATION_ERROR",
        'platform must be "twitter" or "linkedin"',
      ),
    );
    return null;
  }
  return /** @type {"twitter" | "linkedin"} */ (platform);
}

function sendComposioError(req, res, err, fallbackLogMessage) {
  if (err instanceof ComposioServiceError) {
    return res
      .status(err.statusCode || 500)
      .json(apiErrorBody(err.code || "COMPOSIO_ERROR", err.message));
  }
  req.log?.error({ err }, fallbackLogMessage);
  return res
    .status(500)
    .json(apiErrorBody("INTERNAL_ERROR", "Unexpected error handling Composio request"));
}

export async function initiateConnection(req, res) {
  const platform = parsePlatform(req, res);
  if (!platform) return undefined;
  const userId = getUserId(req);
  try {
    const redirectUrl = await getConnectionUrl(userId, platform);
    return res.json({ redirectUrl });
  } catch (err) {
    return sendComposioError(req, res, err, "composio initiate failed");
  }
}

export async function connectionCallback(req, res) {
  const platform = parsePlatform(req, res);
  if (!platform) return undefined;
  const userId = getUserId(req);
  const { User } = getModels();
  const user = await User.findByPk(userId);
  if (!user) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "User not found"));
  }
  try {
    const active = await isConnected(userId, platform);
    if (!active) {
      return res
        .status(409)
        .json(apiErrorBody("NOT_CONNECTED", `Composio reports ${platform} is not active yet`));
    }
    await saveConnectionStatus(userId, platform, user);
    return res.json({ connected: true, platform });
  } catch (err) {
    return sendComposioError(req, res, err, "composio callback failed");
  }
}

export async function getConnectionStatus(req, res) {
  const userId = getUserId(req);
  const { User } = getModels();
  const user = await User.findByPk(userId, {
    attributes: ["twitter_connected", "linkedin_connected"],
  });
  if (!user) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "User not found"));
  }
  return res.json({
    twitter: Boolean(user.twitter_connected),
    linkedin: Boolean(user.linkedin_connected),
  });
}

function parsePublishPlatform(body) {
  const raw = body?.platform;
  const platform = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    return null;
  }
  return /** @type {"twitter" | "linkedin"} */ (platform);
}

function sameUserId(rowUserId, headerUserId) {
  return String(rowUserId ?? "").toLowerCase() === String(headerUserId ?? "").toLowerCase();
}

export async function publishPost(req, res) {
  const platform = parsePublishPlatform(req.body);
  if (!platform) {
    return res
      .status(400)
      .json(apiErrorBody("VALIDATION_ERROR", 'body.platform must be "twitter" or "linkedin"'));
  }
  const userId = getUserId(req);
  const { id: postId } = req.params;
  const { Post, User } = getModels();
  const post = await Post.findByPk(postId);
  if (!post) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "Post not found"));
  }
  if (!sameUserId(post.user_id, userId)) {
    return res.status(403).json(apiErrorBody("FORBIDDEN", "You do not have access to this post"));
  }
  if (post.status !== "selected") {
    return res.status(400).json(
      apiErrorBody(
        "INVALID_STATE",
        `Post must be selected before publishing (current status: ${post.status}).`,
      ),
    );
  }
  const selectedText = post.selected_text;
  if (typeof selectedText !== "string" || selectedText.length === 0) {
    return res
      .status(400)
      .json(apiErrorBody("INVALID_STATE", "Selected post text is empty; save a variation pick first."));
  }
  const user = await User.findByPk(userId, {
    attributes: ["twitter_connected", "linkedin_connected", "composio_entity_id"],
  });
  if (!user) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "User not found"));
  }
  if (platform === "linkedin" && !user.linkedin_connected) {
    return res.status(400).json(apiErrorBody("NOT_CONNECTED", "LinkedIn not connected"));
  }
  if (platform === "twitter" && !user.twitter_connected) {
    return res.status(400).json(apiErrorBody("NOT_CONNECTED", "Twitter not connected"));
  }
  try {
    const composioEntityId =
      typeof user.composio_entity_id === "string" && user.composio_entity_id.trim().length > 0
        ? user.composio_entity_id.trim()
        : userId;
    console.log("[publishPost] start", {
      postId,
      platform,
      userId: String(userId).slice(0, 8),
      composioEntityId: String(composioEntityId).slice(0, 8),
      selectedTextLen: selectedText.length,
      hasImage: Boolean(post.selected_image_base64),
    });
    const result = await executePost(
      composioEntityId,
      platform,
      selectedText,
      post.selected_image_base64 ?? null,
    );
    console.log("[publishPost] composio ok", { postId, platform, resultPostId: result.postId });
    return res.status(200).json({
      success: result.success,
      platform,
      ...(result.postId !== undefined ? { postId: result.postId } : {}),
    });
  } catch (err) {
    console.error("[publishPost] composio failed", { postId, platform, err });
    return sendComposioError(req, res, err, "composio publish post failed");
  }
}

/**
 * Append-only override that enforces publish validation and raw Composio error passthrough.
 */
publishPost = async function publishPost(req, res) {
  const userId = getUserId(req);
  const postId = req.params?.id;
  const platformRaw = req.body?.platform;
  const platform = typeof platformRaw === "string" ? platformRaw.trim().toLowerCase() : "";

  if (platform !== "linkedin" && platform !== "twitter") {
    return res
      .status(400)
      .json(apiErrorBody("VALIDATION_ERROR", 'body.platform must be "twitter" or "linkedin"'));
  }

  const { Post, User } = getModels();
  const post = await Post.findByPk(postId);
  if (!post) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "Post not found"));
  }

  if (String(post.user_id) !== String(userId)) {
    return res.status(403).json(apiErrorBody("FORBIDDEN", "You do not have access to this post"));
  }

  const selectedText = typeof post.selected_text === "string" ? post.selected_text.trim() : "";
  if (post.status !== "selected" || selectedText.length === 0) {
    return res.status(400).json(apiErrorBody("INVALID_STATE", "No variation selected yet"));
  }

  const user = await User.findByPk(userId, {
    attributes: ["linkedin_connected", "twitter_connected", "composio_entity_id"],
  });
  if (!user) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "User not found"));
  }

  if (platform === "linkedin" && !user.linkedin_connected) {
    return res.status(400).json(apiErrorBody("NOT_CONNECTED", "LinkedIn not connected"));
  }
  if (platform === "twitter" && !user.twitter_connected) {
    return res.status(400).json(apiErrorBody("NOT_CONNECTED", "Twitter not connected"));
  }

  try {
    const composioEntityId =
      typeof user.composio_entity_id === "string" && user.composio_entity_id.trim().length > 0
        ? user.composio_entity_id.trim()
        : userId;
    console.log("[publishPost:override] start", {
      postId,
      platform,
      userId: String(userId).slice(0, 8),
      composioEntityId: String(composioEntityId).slice(0, 8),
      selectedTextLen: typeof post.selected_text === "string" ? post.selected_text.length : 0,
      hasImage: Boolean(post.selected_image_base64),
    });
    const result = await executePost(
      composioEntityId,
      platform,
      post.selected_text,
      post.selected_image_base64 ?? null,
    );
    console.log("[publishPost:override] composio ok", { postId, platform, resultPostId: result.postId });
    return res.status(200).json({
      success: true,
      platform,
      ...(result.postId ? { postId: result.postId } : {}),
    });
  } catch (err) {
    console.error("[publishPost:override] composio failed", { postId, platform, err });
    if (err instanceof ComposioServiceError) {
      return res.status(err.statusCode || 502).json(apiErrorBody(err.code || "COMPOSIO_POST_FAILED", err.message));
    }
    req.log?.error({ err }, "composio publish post failed");
    return res.status(500).json(apiErrorBody("INTERNAL_ERROR", "Unexpected error handling Composio request"));
  }
};
