from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama

from app.core.config import Settings, get_settings

GROQ_STRUCTURED_OUTPUT_MODELS: frozenset[str] = frozenset(
    {
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
    }
)

_ALLOWED_PROVIDERS: frozenset[str] = frozenset({"openai", "ollama", "groq"})


def resolve_effective_chat_config(
    provider_override: str | None,
    model_override: str | None,
    *,
    settings: Settings | None = None,
) -> tuple[str, str]:
    """Return (provider, model_id) after applying overrides and defaults."""
    s = settings or get_settings()
    p = (provider_override or "").strip().lower()
    if p:
        if p not in _ALLOWED_PROVIDERS:
            allowed = ", ".join(sorted(_ALLOWED_PROVIDERS))
            raise ValueError(f"model_provider must be one of: {allowed}")
        provider = p
    else:
        provider = s.llm_provider

    m = (model_override or "").strip()
    if provider == "ollama":
        model = m or s.ollama_model
    elif provider == "groq":
        model = m or s.groq_model
    else:
        model = m or s.openai_model

    if provider == "groq" and model not in GROQ_STRUCTURED_OUTPUT_MODELS:
        allowed = ", ".join(sorted(GROQ_STRUCTURED_OUTPUT_MODELS))
        raise ValueError(f"Model {model} does not support structured output on Groq; use one of: {allowed}")

    return provider, model


def validate_request_llm_for_generation(
    model_provider: str | None,
    model_name: str | None,
    *,
    settings: Settings | None = None,
) -> tuple[str, str]:
    """Validate overrides + credentials for the resolved provider. Raises ValueError on invalid input."""
    s = settings or get_settings()
    provider, model = resolve_effective_chat_config(model_provider, model_name, settings=s)
    if provider == "openai" and not (s.openai_api_key or "").strip():
        raise ValueError("OPENAI_API_KEY is required for OpenAI generation")
    if provider == "groq" and not (s.groq_api_key or "").strip():
        raise ValueError("GROQ_API_KEY is required for Groq generation")
    return provider, model


def get_chat_llm(
    *,
    provider_override: str | None = None,
    model_override: str | None = None,
) -> BaseChatModel:
    """Shared chat model for text steps (tweet + visual prompt). Structured output is applied in chains."""
    settings = get_settings()
    provider, model = resolve_effective_chat_config(provider_override, model_override, settings=settings)

    if provider == "ollama":
        return ChatOllama(
            model=model,
            base_url=settings.ollama_base_url,
            temperature=settings.ollama_temperature,
        )
    if provider == "groq":
        return ChatGroq(
            api_key=settings.groq_api_key,
            model=model,
            temperature=settings.groq_temperature,
            timeout=settings.openai_chat_timeout_seconds,
        )
    return ChatOpenAI(
        model=model,
        temperature=settings.openai_temperature,
        api_key=settings.openai_api_key,
        timeout=settings.openai_chat_timeout_seconds,
    )
