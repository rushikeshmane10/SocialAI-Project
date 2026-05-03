from typing import Literal

from pydantic import BaseModel, Field


class TweetDraftOutput(BaseModel):
    """Structured output for step 1 (field name kept for LLM stability)."""

    draft: str = Field(max_length=280)


class VisualPromptOutput(BaseModel):
    image_prompt: str = Field(max_length=1000)


class ImageResult(BaseModel):
    status: Literal["ok", "failed", "skipped"]
    model: str | None = None
    code: str | None = None
    message: str | None = None


class GeneratePipelineResponse(BaseModel):
    post: str
    image_prompt: str | None
    image_url: str | None
    image_base64: str | None = None
    image: ImageResult
    model: str


class GenerateAsyncAcceptedResponse(BaseModel):
    accepted: Literal[True] = True
    request_id: str
