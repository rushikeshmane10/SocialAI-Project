import logging

from openai import AsyncOpenAI, AuthenticationError, BadRequestError, OpenAIError, RateLimitError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_TONE_STYLE_SUFFIX = {
    "humorous": "digital illustration, cartoon, playful, vibrant, comic",
    "professional": "clean corporate photography, minimal, muted, sharp",
    "casual": "warm candid lifestyle, natural light, relaxed",
    "inspirational": "cinematic, golden hour, epic wide-shot",
}

_MAX_PROMPT_LEN = 3900


def _failed(code: str, message: str) -> dict:
    return {
        "status": "failed",
        "code": code,
        "message": message,
    }


async def generate_image_dalle(image_prompt: str, tone: str) -> dict:
    prompt_text = (image_prompt or "").strip()
    tone_key = (tone or "").strip().lower()
    style_suffix = _TONE_STYLE_SUFFIX.get(tone_key, "modern digital art, high quality")
    assembled_prompt = f"{prompt_text}, {style_suffix}"
    if len(assembled_prompt) > _MAX_PROMPT_LEN:
        assembled_prompt = assembled_prompt[:_MAX_PROMPT_LEN]

    logger.info(
        "dalle image generation start tone=%s prompt_len=%d",
        tone_key or "unknown",
        len(assembled_prompt),
    )

    settings = get_settings()
    api_key = (settings.openai_api_key or "").strip()
    if not api_key:
        message = "OPENAI_API_KEY is missing; cannot generate image."
        logger.error("dalle image generation failed: %s", message)
        return _failed("DALLE_API_KEY_MISSING", message)

    client = AsyncOpenAI(
        api_key=api_key,
        timeout=settings.openai_image_timeout_seconds,
    )

    try:
        result = await client.images.generate(
            model="dall-e-3",
            prompt=assembled_prompt,
            size="1024x1024",
            quality="standard",
            response_format="b64_json",
            n=1,
        )
    except RateLimitError as exc:
        message = f"DALL-E rate limited: {exc}"
        logger.error("dalle image generation rate limit tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("DALLE_RATE_LIMIT", message)
    except BadRequestError as exc:
        message = f"DALL-E bad request: {exc}"
        logger.error("dalle image generation bad request tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("DALLE_BAD_REQUEST", message)
    except AuthenticationError as exc:
        message = f"DALL-E authentication failed: {exc}"
        logger.error("dalle image generation auth failed tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("DALLE_AUTH_FAILED", message)
    except OpenAIError as exc:
        message = f"DALL-E request failed: {exc}"
        logger.error("dalle image generation openai error tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("DALLE_IMAGE_GEN_FAILED", message)
    except Exception as exc:
        message = f"DALL-E unexpected error: {exc}"
        logger.error("dalle image generation unexpected error tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("DALLE_IMAGE_GEN_FAILED", message)

    try:
        if not result.data or len(result.data) == 0:
            message = "DALL-E returned no image data."
            logger.error("dalle image generation no data tone=%s", tone_key or "unknown")
            return _failed("DALLE_IMAGE_GEN_FAILED", message)
        first = result.data[0]
        b64 = getattr(first, "b64_json", None)
        if not isinstance(b64, str) or not b64:
            message = "DALL-E response did not include b64_json."
            logger.error("dalle image generation missing b64_json tone=%s", tone_key or "unknown")
            return _failed("DALLE_IMAGE_GEN_FAILED", message)
    except Exception as exc:
        message = f"DALL-E response parse failed: {exc}"
        logger.error("dalle image generation parse error tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("DALLE_IMAGE_GEN_FAILED", message)

    logger.info("dalle image generation success provider=dalle tone=%s", tone_key or "unknown")
    return {"image_base64": b64, "provider": "dalle"}
