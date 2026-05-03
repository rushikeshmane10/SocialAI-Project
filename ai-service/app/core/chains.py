from langchain_core.prompts import ChatPromptTemplate

from app.core.llm import get_chat_llm
from app.core.prompts import TWEET_SYSTEM, VISUAL_SYSTEM
from app.schemas.response_schema import TweetDraftOutput, VisualPromptOutput


def get_tweet_chain(provider: str | None = None, model: str | None = None):
    llm = get_chat_llm(provider_override=provider, model_override=model).with_structured_output(TweetDraftOutput)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", TWEET_SYSTEM),
            (
                "user",
                "Write one tweet for X using the context below.\n\nTopic:\n{topic}\n\nTone to apply:\n{tone}\n\nCreator profile context:\n- Profession: {profession}\n- Audience: {audience}\n- Brand vibe: {vibe}\n\nRework base draft (if any):\n{rework_base_text}\n\nRework instructions (if any):\n{rework_instructions}\n\nOutput must be one high-quality tweet only.",
            ),
        ]
    )
    return prompt | llm


def get_visual_prompt_chain(provider: str | None = None, model: str | None = None):
    llm = get_chat_llm(provider_override=provider, model_override=model).with_structured_output(VisualPromptOutput)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", VISUAL_SYSTEM),
            (
                "user",
                "Generated post text:\n{generated_text}\n\nTone:\n{tone}\n\nCreate a concrete visual scene description that matches the mood, theme, and specific angle of the generated text in this tone. Focus on visual details only.",
            ),
        ]
    )
    return prompt | llm
