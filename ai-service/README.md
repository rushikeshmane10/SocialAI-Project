# AI service (FastAPI)

Small FastAPI app that generates social post drafts with LangChain, optionally derives an image prompt from the draft, and optionally calls OpenAI’s Images API. Configuration is environment-driven via Pydantic settings.

## Folder structure

```
ai-service/
├── .env.example              # Environment variable template
├── requirements.txt          # Python dependencies
├── README.md                 # This file
└── app/
    ├── main.py               # FastAPI app, CORS, router mount, /health
    ├── core/
    │   ├── config.py         # Settings (LLM, image, callback, timeouts)
    │   ├── llm.py            # Chat model factory (OpenAI vs Ollama)
    │   ├── chains.py         # LangChain LCEL pipelines (tweet + visual)
    │   └── prompts.py        # System prompts for tweet and image-prompt steps
    ├── integrations/
    │   └── images.py         # OpenAI async image generation (URL result)
    ├── routes/
    │   └── generate.py       # POST /generate, POST /generate-async, callbacks
    ├── schemas/
    │   ├── requests.py       # Request bodies
    │   ├── response_schema.py # Pipeline + structured LLM output models
    │   └── responses.py      # Re-exports of response_schema models
    └── utils/
        └── text.py           # Draft normalization
```

## Where the LLM runs for post generation

Post text is produced in **`app/routes/generate.py`** inside **`_generate_one`**. That function:

1. Builds the tweet chain with **`get_tweet_chain()`** from **`app/core/chains.py`**.
2. Invokes it asynchronously: **`await chain.ainvoke({...})`** with topic, tone, profession, audience, vibe, and optional rework fields.
3. Validates structured output as **`TweetDraftOutput`**, normalizes the draft string, then runs **`get_visual_prompt_chain()`** and **`await vchain.ainvoke({"post": post})`** for the image-description step.

Synchronous **`POST /generate`** and the background job for **`POST /generate-async`** both funnel through **`_generate_one`** (async path runs two tones and posts results back to Node via HTTP callback).

The actual model selection is not in the route file: **`app/core/chains.py`** calls **`get_chat_llm()`** from **`app/core/llm.py`**, which reads **`get_settings()`** from **`app/core/config.py`** and returns either **`ChatOpenAI`** or **`ChatOllama`**, each wrapped with **`.with_structured_output(...)`** for **`TweetDraftOutput`** / **`VisualPromptOutput`** (defined in **`app/schemas/response_schema.py`**).

## LLM configuration

Settings load from **`.env`** (and process environment) through **`app/core/config.py`** (`Settings` / **`get_settings()`**). Names map to env vars in **SCREAMING_SNAKE_CASE** (Pydantic default).

| Variable | Role |
|----------|------|
| **`LLM_PROVIDER`** | **`openai`** or **`ollama`** — selects the chat backend for both tweet and visual-prompt chains. |
| **`OPENAI_API_KEY`** | Required when **`LLM_PROVIDER=openai`** or when **`IMAGE_PROVIDER=openai`**. |
| **`OPENAI_MODEL`** | Chat model (default `gpt-4o-mini`). |
| **`OPENAI_TEMPERATURE`** | Chat sampling temperature (default `0.7`). |
| **`OPENAI_CHAT_TIMEOUT_SECONDS`** | Chat request timeout in seconds (default `60`). |
| **`OLLAMA_BASE_URL`** | Ollama HTTP root, e.g. `http://localhost:11434` (trailing `/api/chat` is stripped if pasted by mistake). |
| **`OLLAMA_MODEL`** | Ollama model name (default `llama3.1:8b`). |
| **`OLLAMA_TEMPERATURE`** | Ollama chat temperature (default `0.7`). |

Image generation (separate from the LangChain chat LLM) is controlled by **`IMAGE_PROVIDER`**: **`openai`** uses the OpenAI SDK in **`app/integrations/images.py`**; **`none`** skips image API calls after the visual prompt step. Related env vars: **`OPENAI_IMAGE_MODEL`**, **`OPENAI_IMAGE_SIZE`**, **`OPENAI_IMAGE_TIMEOUT_SECONDS`**.

Async jobs (**`/generate-async`**) use **`GENERATE_ASYNC_TONE_TIMEOUT_SECONDS`** (longer default for Ollama) plus OpenAI-derived timeouts when **`LLM_PROVIDER=openai`**. Callback delivery uses **`NODE_CALLBACK_BASE_URL`**, **`GENERATE_CALLBACK_PATH`**, and retry settings listed in **`.env.example`**.

Copy **`.env.example`** to **`.env`** and adjust for your machine. **`get_settings()`** is invoked at app startup (**`app/main.py`** lifespan) so missing required keys fail fast when OpenAI is required.

## End-to-end AI flow

1. **HTTP** — Client calls **`POST /generate`** or **`POST /generate-async`** (`app/routes/generate.py`).
2. **Tweet step** — LangChain **`ChatPromptTemplate`** + chat LLM with structured output → **`TweetDraftOutput.draft`**.
3. **Visual prompt step** — Second chain, same **`get_chat_llm()`**, structured **`VisualPromptOutput.image_prompt`** (failures are non-fatal; response may omit image).
4. **Image step** (optional) — If **`IMAGE_PROVIDER=openai`**, **`generate_image_url`** in **`app/integrations/images.py`** calls **`AsyncOpenAI.images.generate`** and returns a temporary URL when the API provides one.
5. **Async completion** — For **`/generate-async`**, results or errors are **`POST`**ed to the Node backend callback URL built from config.

Prompt text lives in **`app/core/prompts.py`** (**`TWEET_SYSTEM`**, **`VISUAL_SYSTEM`**).

## Run locally

From the `ai-service` directory (with a virtualenv and dependencies installed):

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: **`GET /health`**.
