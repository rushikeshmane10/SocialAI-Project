import asyncio
import logging
import time
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from app.core.chains import get_tweet_chain, get_visual_prompt_chain
from app.core.config import get_settings
from app.core.image_gen import generate_image_base64
from app.core.llm import resolve_effective_chat_config, validate_request_llm_for_generation
from app.schemas.requests import GenerateAsyncRequest, GenerateRequest
from app.schemas.response_schema import (
    GenerateAsyncAcceptedResponse,
    GeneratePipelineResponse,
    ImageResult,
    TweetDraftOutput,
    VisualPromptOutput,
)
from app.utils.text import normalize_draft

logger = logging.getLogger(__name__)

router = APIRouter(tags=["generate"])


class JobGenerationError(Exception):
    def __init__(self, code: str, message: str, *, stage: str, status_code: int = 502):
        super().__init__(message)
        self.code = code
        self.message = message
        self.stage = stage
        self.status_code = status_code


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _callback_url() -> str:
    settings = get_settings()
    return f"{settings.node_callback_base_url.rstrip('/')}{settings.generate_callback_path}"


def _build_meta(body: GenerateAsyncRequest, *, tones: list[str], source_request_id: str) -> dict:
    return {
        "userId": body.user_id,
        "topic": body.topic,
        "tones": tones,
        "sourceRequestId": source_request_id,
    }


def _build_failed_payload(
    *,
    request_id: str,
    code: str,
    message: str,
    stage: str,
    meta: dict,
) -> dict:
    return {
        "requestId": request_id,
        "status": "failed",
        "finishedAt": _iso_utc_now(),
        "error": {"code": code, "message": message, "stage": stage},
        "meta": meta,
    }


async def _generate_one(
    *,
    rid: str,
    topic: str,
    tone: str,
    profession: str | None,
    audience: str | None,
    vibe: str | None,
    rework_base_text: str | None,
    rework_instructions: str | None,
    model_provider: str | None = None,
    model_name: str | None = None,
) -> GeneratePipelineResponse:
    settings = get_settings()
    _, resolved_model_label = resolve_effective_chat_config(model_provider, model_name, settings=settings)

    t0 = time.perf_counter()
    try:
        chain = get_tweet_chain(model_provider, model_name)
        out = await chain.ainvoke(
            {
                "topic": topic,
                "tone": tone,
                "profession": (profession or "").strip() or "not provided",
                "audience": (audience or "").strip() or "not provided",
                "vibe": (vibe or "").strip() or "not provided",
                "rework_base_text": (rework_base_text or "").strip() or "none",
                "rework_instructions": (rework_instructions or "").strip() or "none",
            }
        )
    except Exception as exc:
        logger.exception("tweet chain failed request_id=%s", rid)
        raise JobGenerationError("LLM_PROVIDER_ERROR", "Tweet generation failed", stage="tweet", status_code=502) from exc

    if not isinstance(out, TweetDraftOutput):
        raise JobGenerationError("LLM_PROVIDER_ERROR", "Unexpected model output", stage="tweet", status_code=502)

    post = normalize_draft(out.draft)
    if not post:
        raise JobGenerationError("EMPTY_DRAFT", "Model returned empty draft", stage="tweet", status_code=400)

    logger.info(
        "generate step=tweet ok request_id=%s duration_ms=%.0f post_len=%d",
        rid,
        (time.perf_counter() - t0) * 1000,
        len(post),
    )

    t1 = time.perf_counter()
    image_prompt: str | None = None
    try:
        vchain = get_visual_prompt_chain(model_provider, model_name)
        vout = await vchain.ainvoke({"generated_text": post, "tone": tone})
        if isinstance(vout, VisualPromptOutput) and vout.image_prompt.strip():
            image_prompt = vout.image_prompt.strip()[:1000]
    except Exception:
        logger.exception("visual prompt failed request_id=%s", rid)
        return GeneratePipelineResponse(
            post=post,
            image_prompt=None,
            image_url=None,
            image_base64=None,
            image=ImageResult(
                status="failed",
                code="VISUAL_PROMPT_FAILED",
                message="Could not create an image description from this post.",
            ),
            model=resolved_model_label,
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
            image_base64=None,
            image=ImageResult(
                status="failed",
                code="VISUAL_PROMPT_EMPTY",
                message="Image description was empty.",
            ),
            model=resolved_model_label,
        )

    t2 = time.perf_counter()
    image_base64 = await generate_image_base64(image_prompt, tone)
    logger.info(
        "generate step=image done request_id=%s duration_ms=%.0f has_image=%s",
        rid,
        (time.perf_counter() - t2) * 1000,
        bool(image_base64),
    )
    if image_base64:
        return GeneratePipelineResponse(
            post=post,
            image_prompt=image_prompt,
            image_url=None,
            image_base64=image_base64,
            image=ImageResult(status="ok", model="pollinations/flux"),
            model=resolved_model_label,
        )
    return GeneratePipelineResponse(
        post=post,
        image_prompt=image_prompt,
        image_url=None,
        image_base64=None,
        image=ImageResult(
            status="failed",
            code="IMAGE_GEN_FAILED",
            message="Image generation failed; text is still available.",
        ),
        model=resolved_model_label,
    )


@router.post("/generate", response_model=GeneratePipelineResponse)
async def generate(request: Request, body: GenerateRequest) -> GeneratePipelineResponse:
    rid = request.headers.get("x-request-id") or "-"
    try:
        validate_request_llm_for_generation(body.model_provider, body.model_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    try:
        return await _generate_one(
            rid=rid,
            topic=body.topic,
            tone=body.tone or "neutral",
            profession=body.profession,
            audience=body.audience,
            vibe=body.vibe,
            rework_base_text=body.rework_base_text,
            rework_instructions=body.rework_instructions,
            model_provider=body.model_provider,
            model_name=body.model_name,
        )
    except JobGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from None


async def _post_generate_callback(*, rid: str, payload: dict) -> None:
    settings = get_settings()
    url = _callback_url()
    attempt = 0
    delay = max(settings.generate_callback_retry_base_seconds, 0.1)
    max_attempts = max(settings.generate_callback_max_attempts, 1)

    while attempt < max_attempts:
        attempt += 1
        try:
            async with httpx.AsyncClient(timeout=settings.generate_callback_timeout_seconds) as client:
                res = await client.post(
                    url,
                    json=payload,
                    headers={"content-type": "application/json", "x-request-id": rid},
                )
            if 200 <= res.status_code < 300:
                logger.info("callback sent request_id=%s attempt=%d status_code=%d", rid, attempt, res.status_code)
                return
            logger.warning(
                "callback non-2xx request_id=%s attempt=%d status_code=%d stage=callback_delivery",
                rid,
                attempt,
                res.status_code,
            )
        except Exception:
            logger.exception("callback failed request_id=%s attempt=%d stage=callback_delivery", rid, attempt)

        if attempt < max_attempts:
            await asyncio.sleep(delay)
            delay *= 2

    logger.error("callback dropped request_id=%s after attempts=%d stage=callback_delivery", rid, max_attempts)


async def _run_generate_job(job_id: str, parent_request_id: str, body: GenerateAsyncRequest) -> None:
    tones = [t.strip() for t in body.tones if t and t.strip()]
    meta = _build_meta(body, tones=tones, source_request_id=parent_request_id)

    if len(tones) != 2:
        await _post_generate_callback(
            rid=job_id,
            payload=_build_failed_payload(
                request_id=job_id,
                code="INVALID_INPUT",
                message="Exactly two tones are required",
                stage="input",
                meta=meta,
            ),
        )
        return

    settings = get_settings()
    eff_provider, _ = resolve_effective_chat_config(body.model_provider, body.model_name, settings=settings)
    if eff_provider == "ollama":
        timeout_seconds = max(settings.generate_async_tone_timeout_seconds, 120)
    else:
        timeout_seconds = max(
            settings.openai_chat_timeout_seconds + settings.openai_image_timeout_seconds + 15,
            30,
        )
    try:
        first = await asyncio.wait_for(
            _generate_one(
                rid=f"{job_id}-tone-1",
                topic=body.topic,
                tone=tones[0],
                profession=body.profession,
                audience=body.audience,
                vibe=body.vibe,
                rework_base_text=body.rework_base_text,
                rework_instructions=body.rework_instructions,
                model_provider=body.model_provider,
                model_name=body.model_name,
            ),
            timeout=timeout_seconds,
        )
        second = await asyncio.wait_for(
            _generate_one(
                rid=f"{job_id}-tone-2",
                topic=body.topic,
                tone=tones[1],
                profession=body.profession,
                audience=body.audience,
                vibe=body.vibe,
                rework_base_text=body.rework_base_text,
                rework_instructions=body.rework_instructions,
                model_provider=body.model_provider,
                model_name=body.model_name,
            ),
            timeout=timeout_seconds,
        )
        v1 = first.post.strip()
        v2 = second.post.strip()
        payload = {
            "requestId": job_id,
            "status": "succeeded",
            "finishedAt": _iso_utc_now(),
            "result": {
                "postId": None,
                "variations": [
                    {
                        "variation_id": 1,
                        "text": v1,
                        "tone_applied": tones[0],
                        "estimated_length": f"{len(v1)} chars",
                        "hashtags": [],
                        "image_base64": first.image_base64,
                    },
                    {
                        "variation_id": 2,
                        "text": v2,
                        "tone_applied": tones[1],
                        "estimated_length": f"{len(v2)} chars",
                        "hashtags": [],
                        "image_base64": second.image_base64,
                    },
                ],
                "model": ", ".join([m for m in [first.model, second.model] if m]) or None,
            },
            "meta": meta,
        }
    except asyncio.TimeoutError:
        payload = _build_failed_payload(
            request_id=job_id,
            code="JOB_TIMEOUT",
            message="Generation job timed out",
            stage="job",
            meta=meta,
        )
    except JobGenerationError as exc:
        payload = _build_failed_payload(
            request_id=job_id,
            code=exc.code,
            message=exc.message,
            stage=exc.stage,
            meta=meta,
        )
    except Exception:
        logger.exception("background generation failed request_id=%s", job_id)
        payload = _build_failed_payload(
            request_id=job_id,
            code="GENERATION_FAILED",
            message="Background generation failed",
            stage="job",
            meta=meta,
        )

    await _post_generate_callback(rid=job_id, payload=payload)


@router.post("/generate-async", response_model=GenerateAsyncAcceptedResponse)
async def generate_async(
    request: Request, background_tasks: BackgroundTasks, body: GenerateAsyncRequest
) -> GenerateAsyncAcceptedResponse:
    rid = request.headers.get("x-request-id") or "-"
    try:
        validate_request_llm_for_generation(body.model_provider, body.model_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    job_id = str(uuid4())
    background_tasks.add_task(_run_generate_job, job_id, rid, body)
    logger.info("generation accepted request_id=%s worker_request_id=%s", rid, job_id)
    return GenerateAsyncAcceptedResponse(accepted=True, request_id=job_id)
