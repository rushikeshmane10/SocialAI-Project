import base64
import logging
from urllib.parse import quote

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_TONE_STYLE_SUFFIX = {
    "humorous": "digital illustration, cartoon style, playful, vibrant colors, comic, fun",
    "professional": "clean corporate photography, minimal, business professional, muted tones, sharp",
    "casual": "warm candid photography, lifestyle, natural light, relaxed",
    "inspirational": "cinematic, golden hour, motivational poster, epic wide shot",
}


async def generate_image_base64(prompt: str, tone: str) -> str | None:
    prompt_text = (prompt or "").strip()
    if not prompt_text:
        return None

    settings = get_settings()
    if (settings.image_provider or "").strip().lower() == "gemini":
        from app.core.gemini_image_gen import generate_image_gemini

        gemini_result = await generate_image_gemini(prompt_text, tone)
        image_base64 = gemini_result.get("image_base64")
        if isinstance(image_base64, str) and image_base64:
            return image_base64
        logger.warning(
            "gemini image generation returned no image; falling back to pollinations tone=%s",
            (tone or "").strip().lower() or "unknown",
        )

    if (settings.image_provider or "").strip().lower() == "dalle":
        from app.core.dalle_image_gen import generate_image_dalle

        dalle_result = await generate_image_dalle(prompt_text, tone)
        dalle_b64 = dalle_result.get("image_base64")
        if isinstance(dalle_b64, str) and dalle_b64:
            return dalle_b64
        logger.warning(
            "dalle image generation returned no image; falling back to pollinations tone=%s",
            (tone or "").strip().lower() or "unknown",
        )

    tone_key = (tone or "").strip().lower()
    style_suffix = _TONE_STYLE_SUFFIX.get(tone_key, "modern digital art, high quality")
    final_prompt = f"{prompt_text}, {style_suffix}"
    encoded_prompt = quote(final_prompt, safe="")

    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}"
    params = {
        "width": 1024,
        "height": 1024,
        "model": "flux",
        "nologo": "true",
        "enhance": "false",
        "safe": "true",
    }
    timeout = httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, params=params)
        if response.status_code != 200:
            logger.warning(
                "pollinations image generation failed status=%s tone=%s prompt_preview=%s",
                response.status_code,
                tone_key or "unknown",
                prompt_text[:80],
            )
            return None
        return base64.b64encode(response.content).decode("utf-8")
    except Exception as exc:
        logger.warning(
            "pollinations image generation error tone=%s prompt_preview=%s error=%s",
            tone_key or "unknown",
            prompt_text[:80],
            str(exc),
        )
        return None
