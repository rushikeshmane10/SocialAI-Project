import { env } from "../config/env.js";
import { testLinkedinImagePostViaComposio, ComposioServiceError } from "../services/composio.service.js";
import { apiErrorBody } from "../utils/response.js";

// TEST ONLY: ad-hoc endpoint to verify LinkedIn image posting via Composio.
export async function testLinkedinImagePostHandler(req, res) {
  const userId = (
    env.COMPOSIO_ENTITY_ID ||
    (typeof process.env.COMPOSIO_ENTITY_ID === "string" ? process.env.COMPOSIO_ENTITY_ID : "")
  ).trim();

  if (!userId) {
    return res.status(400).json(
      apiErrorBody(
        "VALIDATION_ERROR",
        "COMPOSIO_ENTITY_ID is required for this test endpoint.",
      ),
    );
  }

  try {
    const result = await testLinkedinImagePostViaComposio(userId);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    if (err instanceof ComposioServiceError) {
      return res.status(err.statusCode || 502).json({
        success: false,
        error: {
          code: err.code || "COMPOSIO_POST_FAILED",
          message: err.message,
        },
      });
    }
    req.log?.error({ err }, "test linkedin image post failed");
    return res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected test endpoint error.",
      },
    });
  }
}
