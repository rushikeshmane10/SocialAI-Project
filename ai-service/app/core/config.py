from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    llm_provider: Literal["openai", "ollama", "groq"] = "groq"
    image_provider: str = "pollinations"  # options: pollinations | gemini | dalle
    gemini_api_key: str = ""
    gemini_image_model: str = "gemini-2.5-flash-image"

    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    groq_temperature: float = 0.7

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.7
    openai_chat_timeout_seconds: int = 60
    openai_image_model: str = "dall-e-3"
    openai_image_size: str = "1024x1024"
    openai_image_timeout_seconds: int = 120

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    ollama_temperature: float = 0.7

    allowed_origins: str = "http://localhost:5173,http://localhost:3001"
    node_callback_base_url: str = "http://127.0.0.1:3001"
    generate_callback_path: str = "/ai/callback/generate-complete"
    generate_callback_timeout_seconds: int = 8
    generate_callback_max_attempts: int = 3
    generate_callback_retry_base_seconds: float = 1.0
    # Per-tone ceiling for /generate-async (each tone runs tweet + visual LLM; Ollama is often slower than OpenAI).
    generate_async_tone_timeout_seconds: int = 600

    @field_validator("ollama_base_url", mode="before")
    @classmethod
    def normalize_ollama_base_url(cls, v: object) -> object:
        """Ollama HTTP API root (LangChain), not .../api/chat."""
        if not isinstance(v, str):
            return v
        u = v.rstrip("/")
        if u.endswith("/api/chat"):
            return u[: -len("/api/chat")]
        return u

    @model_validator(mode="after")
    def require_openai_when_needed(self) -> "Settings":
        openai_key = (self.openai_api_key or "").strip()
        groq_key = (self.groq_api_key or "").strip()
        if self.llm_provider == "openai" and not openai_key:
            msg = "OPENAI_API_KEY is required when LLM_PROVIDER=openai"
            raise ValueError(msg)
        if self.llm_provider == "groq" and not groq_key:
            msg = "GROQ_API_KEY is required when LLM_PROVIDER=groq"
            raise ValueError(msg)
        if self.image_provider == "openai" and not openai_key:
            msg = "OPENAI_API_KEY is required when IMAGE_PROVIDER=openai"
            raise ValueError(msg)
        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def active_chat_model(self) -> str:
        if self.llm_provider == "ollama":
            return self.ollama_model
        if self.llm_provider == "groq":
            return self.groq_model
        return self.openai_model


def get_settings() -> Settings:
    return Settings()
