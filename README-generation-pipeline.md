# Generation Pipeline (Text + Image)

Short, exact reference for how generation works today across `frontend`, `backend`, and `ai-service`.

## 1) End-to-End Flow

1. Frontend sends `POST /ai/generate` with topic + two tones.
2. Backend validates and forwards to Python `POST /generate-async`.
3. AI service runs generation twice (tone 1 + tone 2).
4. AI service calls backend callback: `POST /ai/callback/generate-complete`.
5. Backend optionally persists callback result, then emits Socket.IO event `generation_lifecycle` to room `generation:{requestId}`.
6. Frontend receives event, shows 2 variations, user picks one.

Pattern: HTTP `202` for start + callback/socket for completion.

## 2) Frontend Logic

Main files:
- `frontend/src/pages/GeneratorPage.tsx`
- `frontend/src/api/generate.ts`
- `frontend/src/hooks/useGenerationSocket.ts`
- `frontend/src/types/generate.ts`

Request sent from frontend (`/ai/generate`):

- `topic` (string)
- `tones` (exactly 2 strings)
- optional rework: `reworkBaseText`, `reworkInstructions`, `sourcePostId`, `sourceVariationId`
- optional model override: `modelProvider` (`groq|openai|ollama`), `modelName`

Current UI model options:

- Groq `llama-3.3-70b-versatile` (default)
- OpenAI `gpt-4o-mini`
- Ollama `llama3.1:8b`

## 3) Backend Logic

Main files:
- `backend/src/controllers/ai.controller.js`
- `backend/src/services/aiClient.service.js`
- `backend/src/validations/ai.validations.js`
- `backend/src/routes/ai.routes.js`

`POST /ai/generate` validation:

- `topic`: max 200; min 3 when not rework mode
- `tones`: exactly 2 unique values, each max 40
- `reworkBaseText`: max 280
- `reworkInstructions`: max 400
- `sourcePostId`: optional UUID
- `sourceVariationId`: optional 1 or 2 (required with rework instructions)
- `modelProvider`: `openai|groq|ollama` (optional)
- `modelName`: max 128 (optional)

Backend -> AI service payload (`POST /generate-async`):

- `topic`, `tones`
- `profession`, `audience`, `vibe` (currently `null` in this flow)
- `rework_base_text`, `rework_instructions`
- `user_id`
- `model_provider`, `model_name`

Callback endpoint:

- `POST /ai/callback/generate-complete`
- `status: "succeeded"` includes `result.variations` (2), optional `postId/model/pipeline`
- `status: "failed"` includes `error.code`, `error.message`, optional `error.stage`

Parser limit for base64 callback payloads:

- backend uses `express.json({ limit: env.JSON_BODY_LIMIT })`
- default `JSON_BODY_LIMIT=1mb`

## 4) AI Service Logic

Main files:
- `ai-service/app/routes/generate.py`
- `ai-service/app/core/chains.py`
- `ai-service/app/core/prompts.py`
- `ai-service/app/core/llm.py`
- `ai-service/app/core/image_gen.py`

Endpoints:

- `POST /generate`: sync, single tone
- `POST /generate-async`: async, two tones + callback

Request models:

- `GenerateRequest`: `topic`, `tone`, context fields, rework fields, optional model override
- `GenerateAsyncRequest`: same + `tones` (length 2) + optional `user_id`

## 5) Text Generation Pipeline (per tone)

Inside `_generate_one(...)`:

1. Build tweet chain (`get_tweet_chain`) with `TWEET_SYSTEM`.
2. Use structured output schema `TweetDraftOutput` (`draft`, max 280).
3. Inputs: `topic`, `tone`, `profession`, `audience`, `vibe`, `rework_base_text`, `rework_instructions`.
4. Normalize output (`normalize_draft`), reject empty draft.

Prompt constraints enforced by system prompt/schema:

- one tweet only
- max 280 chars
- plain text (no markdown)
- avoid hashtags/URLs unless requested
- keep topic-grounded and tone-aligned
- rework should preserve base intent + apply requested edits

Async mode behavior:

- `/generate-async` runs `_generate_one` twice (tone-1 then tone-2), each with timeout
- callback returns two variations

## 6) Image Generation Pipeline (per tone)

Step A: Visual prompt generation:

- `get_visual_prompt_chain` with `VISUAL_SYSTEM`
- input: generated text + tone
- output: `image_prompt` (`VisualPromptOutput`, max 1000)

Step B: Image model call:

- file: `ai-service/app/core/image_gen.py`
- provider used in active route: Pollinations (`flux`)
- endpoint: `https://image.pollinations.ai/prompt/{encoded_prompt}`
- params: `width=1024`, `height=1024`, `model=flux`, `nologo=true`, `enhance=false`, `safe=true`
- timeout: connect 10s, read 60s, write/pool 10s
- returned as `image_base64` (bytes -> base64)

Failure behavior:

- if visual/image fails, text is still returned
- image section reports failed status/code (e.g., `IMAGE_GEN_FAILED`)

## 7) Tone -> Image Style Mapping

Used in `image_gen.py` as suffix added to visual prompt:

- `humorous`: digital illustration, cartoon, playful, vibrant, comic
- `professional`: clean corporate photography, minimal, muted, sharp
- `casual`: warm candid lifestyle, natural light, relaxed
- `inspirational`: cinematic, golden hour, epic wide-shot
- fallback: modern digital art, high quality

Final prompt sent to Pollinations:

- `"{visual_prompt_from_llm}, {tone_style_suffix}"`

## 8) Model/Tool Stack

Text LLM backends (`ai-service/app/core/llm.py`):

- OpenAI -> `ChatOpenAI`
- Groq -> `ChatGroq`
- Ollama -> `ChatOllama`

Resolution rule:

- request override (`model_provider`, `model_name`) if supplied
- otherwise service defaults from settings

Groq structured-output allowlist:

- `llama-3.3-70b-versatile`
- `llama-3.1-70b-versatile`

Image stack in active path:

- Pollinations Flux + base64 payload in callback

Also present but not active in this route:

- `ai-service/app/integrations/images.py` (OpenAI Images `dall-e-3`, URL output path)

## 9) Key Config

Backend:

- `AI_SERVICE_URL`
- `AI_SERVICE_TIMEOUT_MS`
- `AI_SERVICE_GENERATE_TIMEOUT_MS`
- `JSON_BODY_LIMIT`

AI service:

- `LLM_PROVIDER`
- `GROQ_API_KEY`, `OPENAI_API_KEY`
- `GROQ_MODEL`, `OPENAI_MODEL`, `OLLAMA_MODEL`
- `NODE_CALLBACK_BASE_URL`, `GENERATE_CALLBACK_PATH`
- `GENERATE_CALLBACK_TIMEOUT_SECONDS`
- `GENERATE_CALLBACK_MAX_ATTEMPTS`
- `GENERATE_CALLBACK_RETRY_BASE_SECONDS`

Two tones in -> two text drafts + two optional base64 images out -> async callback/socket -> user picks one variation for posting.

