from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = 0.7
    openai_chat_timeout_seconds: int = 60
    openai_image_model: str = "dall-e-3"
    openai_image_size: str = "1024x1024"
    openai_image_timeout_seconds: int = 120
    allowed_origins: str = "http://localhost:5173,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


def get_settings() -> Settings:
    return Settings()
