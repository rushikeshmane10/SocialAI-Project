import logging
import time

from fastapi import APIRouter, HTTPException, Request

from app.core.chains import get_tweet_chain, get_visual_prompt_chain
from app.core.config import get_settings
from app.integrations.images import ImageGenerationError, generate_image_url
from app.schemas.requests import GenerateRequest
from app.schemas.response_schema import (
    GeneratePipelineResponse,
    ImageResult,
    TweetDraftOutput,
    VisualPromptOutput,
)
from app.utils.text import normalize_draft

logger = logging.getLogger(__name__)

router = APIRouter(tags=["generate"])


@router.post("/generate", response_model=GeneratePipelineResponse)
async def generate(request: Request, body: GenerateRequest) -> GeneratePipelineResponse:
    rid = request.headers.get("x-request-id") or "-"
    settings = get_settings()
    tone = body.tone or "neutral"

    t0 = time.perf_counter()
    try:
        chain = get_tweet_chain()
        out = await chain.ainvoke({"topic": body.topic, "tone": tone})
    except Exception:
        logger.exception("tweet chain failed request_id=%s", rid)
        raise HTTPException(status_code=502, detail="LLM provider error") from None

    if not isinstance(out, TweetDraftOutput):
        raise HTTPException(status_code=502, detail="Unexpected model output")

    post = normalize_draft(out.draft)
    if not post:
        raise HTTPException(status_code=400, detail="Model returned empty draft")

    logger.info(
        "generate step=tweet ok request_id=%s duration_ms=%.0f post_len=%d",
        rid,
        (time.perf_counter() - t0) * 1000,
        len(post),
    )

    t1 = time.perf_counter()
    image_prompt: str | None = None
    try:
        vchain = get_visual_prompt_chain()
        vout = await vchain.ainvoke({"post": post})
        if isinstance(vout, VisualPromptOutput) and vout.image_prompt.strip():
            image_prompt = vout.image_prompt.strip()[:1000]
    except Exception:
        logger.exception("visual prompt failed request_id=%s", rid)
        return GeneratePipelineResponse(
            post=post,
            image_prompt=None,
            image_url=None,
            image=ImageResult(
                status="failed",
                code="VISUAL_PROMPT_FAILED",
                message="Could not create an image description from this post.",
            ),
            model=settings.openai_model,
        )

    logger.info(
        "generate step=visual ok request_id=%s duration_ms=%.0f prompt_len=%d",
        rid,
        (time.perf_counter() - t1) * 1000,
        len(image_prompt) if image_prompt else 0,
    )

    if not image_prompt:
        return GeneratePipelineResponse(
            post=post,
            image_prompt=None,
            image_url=None,
            image=ImageResult(
                status="failed",
                code="VISUAL_PROMPT_EMPTY",
                message="Image description was empty.",
            ),
            model=settings.openai_model,
        )

    t2 = time.perf_counter()
    try:
        url = await generate_image_url(image_prompt)
        logger.info(
            "generate step=image ok request_id=%s duration_ms=%.0f",
            rid,
            (time.perf_counter() - t2) * 1000,
        )
        return GeneratePipelineResponse(
            post=post,
            image_prompt=image_prompt,
            image_url=url,
            image=ImageResult(status="ok", model=settings.openai_image_model),
            model=settings.openai_model,
        )
    except ImageGenerationError as e:
        logger.warning(
            "generate step=image failed request_id=%s code=%s",
            rid,
            e.code,
        )
        return GeneratePipelineResponse(
            post=post,
            image_prompt=image_prompt,
            image_url=None,
            image=ImageResult(status="failed", code=e.code, message=e.safe_message),
            model=settings.openai_model,
        )
