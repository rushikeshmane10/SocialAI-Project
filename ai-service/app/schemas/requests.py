from typing import Literal

from pydantic import BaseModel, Field

LlmProviderName = Literal["openai", "groq", "ollama"]


class GenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=200)
    tone: str | None = Field(default=None, max_length=40)
    profession: str | None = Field(default=None, max_length=200)
    audience: str | None = Field(default=None, max_length=200)
    vibe: str | None = Field(default=None, max_length=200)
    rework_base_text: str | None = Field(default=None, max_length=280)
    rework_instructions: str | None = Field(default=None, max_length=400)
    linkedin_profile: str | None = Field(default=None, max_length=2000)
    template_context: str | None = Field(default=None, max_length=5000)
    model_provider: LlmProviderName | None = None
    model_name: str | None = Field(default=None, max_length=128)


class GenerateAsyncRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=200)
    tones: list[str] = Field(min_length=2, max_length=2)
    profession: str | None = Field(default=None, max_length=200)
    audience: str | None = Field(default=None, max_length=200)
    vibe: str | None = Field(default=None, max_length=200)
    rework_base_text: str | None = Field(default=None, max_length=280)
    rework_instructions: str | None = Field(default=None, max_length=400)
    linkedin_profile: str | None = Field(default=None, max_length=2000)
    template_context: str | None = Field(default=None, max_length=5000)
    user_id: str | None = Field(default=None, max_length=64)
    model_provider: LlmProviderName | None = None
    model_name: str | None = Field(default=None, max_length=128)
