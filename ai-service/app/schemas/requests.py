from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=200)
    tone: str | None = Field(default=None, max_length=40)
