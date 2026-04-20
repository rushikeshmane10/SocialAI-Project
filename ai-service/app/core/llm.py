from langchain_openai import ChatOpenAI

from app.core.config import get_settings


def get_chat_llm() -> ChatOpenAI:
    """Shared chat model for text steps (tweet + visual prompt)."""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.openai_model,
        temperature=settings.openai_temperature,
        api_key=settings.openai_api_key,
        timeout=settings.openai_chat_timeout_seconds,
    )
