from langchain_core.prompts import ChatPromptTemplate

from app.core.llm import get_chat_llm
from app.core.prompts import TWEET_SYSTEM, VISUAL_SYSTEM
from app.schemas.response_schema import TweetDraftOutput, VisualPromptOutput


def get_tweet_chain():
    llm = get_chat_llm().with_structured_output(TweetDraftOutput)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", TWEET_SYSTEM),
            ("user", "Topic:\n{topic}\n\nDesired tone:\n{tone}"),
        ]
    )
    return prompt | llm


def get_visual_prompt_chain():
    llm = get_chat_llm().with_structured_output(VisualPromptOutput)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", VISUAL_SYSTEM),
            (
                "user",
                "Social post to visualize (use its meaning, not its wording literally if it is abstract):\n{post}",
            ),
        ]
    )
    return prompt | llm
