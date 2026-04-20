import logging

from openai import APIStatusError, AsyncOpenAI, OpenAIError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ImageGenerationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.safe_message = message


async def generate_image_url(prompt: str) -> str:
    """Call OpenAI Images API; return a temporary HTTPS URL when available."""
    settings = get_settings()
    client = AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.openai_image_timeout_seconds,
    )
    try:
        result = await client.images.generate(
            model=settings.openai_image_model,
            prompt=prompt,
            size=settings.openai_image_size,  # type: ignore[arg-type]
            n=1,
        )
    except APIStatusError as e:
        status = getattr(e, "status_code", None) or 502
        if status == 400:
            raise ImageGenerationError(
                "IMAGE_POLICY",
                "Image request was rejected. Try a different topic or tone.",
            ) from e
        logger.warning("OpenAI image API status error: %s", e)
        raise ImageGenerationError(
            "IMAGE_GEN_FAILED",
            "Image generation failed. Please try again later.",
        ) from e
    except OpenAIError as e:
        logger.warning("OpenAI image API error: %s", e)
        raise ImageGenerationError(
            "IMAGE_GEN_FAILED",
            "Image generation failed. Please try again later.",
        ) from e

    if not result.data or len(result.data) == 0:
        raise ImageGenerationError("IMAGE_GEN_FAILED", "No image was returned.")

    first = result.data[0]
    url = getattr(first, "url", None)
    if url:
        return url

    # Some models return b64_json only — MVP: surface as failure unless we add hosting
    raise ImageGenerationError(
        "IMAGE_NO_URL",
        "Image was generated but no URL is available for this model configuration.",
    )
