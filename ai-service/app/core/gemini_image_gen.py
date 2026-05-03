import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_TONE_STYLE_SUFFIX = {
    "humorous": "digital illustration, cartoon, playful, vibrant, comic",
    "professional": "clean corporate photography, minimal, muted, sharp",
    "casual": "warm candid lifestyle, natural light, relaxed",
    "inspirational": "cinematic, golden hour, epic wide-shot",
}

def _failed(code: str, message: str) -> dict:
    return {
        "status": "failed",
        "code": code,
        "message": message,
    }


async def generate_image_gemini(image_prompt: str, tone: str) -> dict:
    prompt_text = (image_prompt or "").strip()
    tone_key = (tone or "").strip().lower()
    style_suffix = _TONE_STYLE_SUFFIX.get(tone_key, "modern digital art, high quality")
    assembled_prompt = f"{prompt_text}, {style_suffix}"
    logger.info("gemini image generation start tone=%s prompt_len=%d", tone_key or "unknown", len(assembled_prompt))

    settings = get_settings()
    api_key = (settings.gemini_api_key or "").strip()
    model_name = (settings.gemini_image_model or "").strip()
    if not api_key:
        message = "GEMINI_API_KEY is missing; cannot generate image."
        logger.error("gemini image generation failed: %s", message)
        return _failed("GEMINI_IMAGE_GEN_FAILED", message)
    if not model_name:
        message = "GEMINI_IMAGE_MODEL is missing; cannot generate image."
        logger.error("gemini image generation failed: %s", message)
        return _failed("GEMINI_IMAGE_GEN_FAILED", message)
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"

    timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)
    headers = {
        "X-goog-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": assembled_prompt},
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE", "TEXT"],
        },
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(gemini_url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        message = f"Gemini request timed out: {exc}"
        logger.error("gemini image generation timeout tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("GEMINI_TIMEOUT", message)
    except Exception as exc:
        message = f"Gemini request failed: {exc}"
        logger.error("gemini image generation error tone=%s error=%s", tone_key or "unknown", str(exc))
        return _failed("GEMINI_IMAGE_GEN_FAILED", message)

    if response.status_code < 200 or response.status_code >= 300:
        message = f"Gemini HTTP {response.status_code}"
        logger.error(
            "gemini image generation non-2xx status=%s body=%s",
            response.status_code,
            response.text[:1000],
        )
        return _failed("GEMINI_IMAGE_GEN_FAILED", message)

    try:
        data = response.json()
    except Exception as exc:
        message = f"Invalid Gemini JSON response: {exc}"
        logger.error("gemini image generation invalid JSON error=%s", str(exc))
        return _failed("GEMINI_IMAGE_GEN_FAILED", message)

    candidates = data.get("candidates", [])
    for candidate in candidates:
        content = candidate.get("content", {})
        parts = content.get("parts", [])
        for part in parts:
            inline_data = part.get("inlineData")
            if not isinstance(inline_data, dict):
                continue
            mime_type = inline_data.get("mimeType", "")
            image_data = inline_data.get("data")
            if isinstance(mime_type, str) and mime_type.startswith("image/") and isinstance(image_data, str) and image_data:
                return {"image_base64": image_data, "provider": "gemini"}

    message = "Gemini response did not include an image part."
    logger.error("gemini image generation no image in response tone=%s", tone_key or "unknown")
    return _failed("GEMINI_NO_IMAGE_IN_RESPONSE", message)
