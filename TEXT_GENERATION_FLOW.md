# Text Generation Flow (Short Version)

End-to-end flow for generation across frontend, Node backend, and Python service.

## 1) Frontend Intake

- Input component: `frontend/src/components/TopicForm.tsx` (`TopicForm`)
  - Topic captured by textarea `onChange -> onTopicChange(...)`
  - Tones selected in UI (max 2)
- Page orchestrator: `frontend/src/pages/GeneratorPage.tsx` (`GeneratorPage`)
  - `onGenerateAi()` reads `aiTopic`, `aiTones`, `llmSelection`
  - Calls `generateMockPosts(...)`
- API wrapper: `frontend/src/api/generate.ts`
  - `generateMockPosts(body)` -> `POST /ai/generate`

```ts
interface GenerateMockPostsBody {
  topic: string;
  tones: [string, string];
  reworkBaseText?: string;
  reworkInstructions?: string;
  sourcePostId?: string;
  sourceVariationId?: number;
  modelProvider?: "openai" | "groq" | "ollama";
  modelName?: string;
}
```

## 2) Backend Request Handling

- Route file: `backend/src/routes/ai.routes.js`
  - `POST /ai/generate` -> `generateTweetHandlerPersist`
  - `POST /ai/callback/generate-complete` -> `generateCompleteCallbackHandler`
- Controller file: `backend/src/controllers/ai.controller.js`
- Validation file: `backend/src/validations/ai.validations.js` (`generateTweetBodySchema`)

Rules enforced:
- `topic`: trimmed, max 200 (min 3 when not rework)
- `tones`: exactly 2 unique entries
- `sourceVariationId`: required (1|2) when rework instructions are provided
- model override optional: `openai | groq | ollama`

Immediate response to frontend (202):

```json
{
  "ok": true,
  "status": "started",
  "requestId": "python-job-id",
  "message": "We started working on your post.",
  "insights": {}
}
```

## 3) Node -> Python Async Job Start

- Trigger function: `backend/src/services/aiClient.service.js::startGenerateDraftJob`
- Transport: HTTP POST
- Endpoint: `{AI_SERVICE_URL}/generate-async`
- Headers: `content-type`, `x-request-id`

Payload sent:

```json
{
  "topic": "string",
  "tones": ["tone1", "tone2"],
  "profession": "string|null",
  "audience": "string|null",
  "vibe": "string|null",
  "rework_base_text": "string|null",
  "rework_instructions": "string|null",
  "user_id": "uuid|null",
  "model_provider": "openai|groq|ollama|null",
  "model_name": "string|null"
}
```

Python ack expected:

```json
{ "accepted": true, "request_id": "worker-id" }
```

## 4) Python Generation Logic

Main files:
- `ai-service/app/routes/generate.py`
- `ai-service/app/core/chains.py`
- `ai-service/app/core/llm.py`
- `ai-service/app/schemas/requests.py`
- `ai-service/app/schemas/response_schema.py`

Core async flow:
- `POST /generate-async` -> `generate_async(...)`
- Background task -> `_run_generate_job(...)`
- Per tone -> `_generate_one(...)`

Execution mode:
- Two tones are generated **sequentially** (`await tone1` then `await tone2`).
- Inside each tone: tweet -> visual prompt -> optional image (sequential).

AI stack:
- LangChain LCEL + structured outputs
- Models via `get_chat_llm(...)`:
  - `ChatOpenAI`, `ChatGroq`, `ChatOllama`
- Structured schemas:
  - `TweetDraftOutput` (`draft`)
  - `VisualPromptOutput` (`image_prompt`)

Variation shape produced:

```ts
interface GeneratedVariation {
  variation_id: 1 | 2;
  text: string;
  tone_applied: string;
  estimated_length: string;
  hashtags: string[];
}
```

## 5) Python -> Node Callback

- Sender: `ai-service/app/routes/generate.py::_post_generate_callback`
- Transport: HTTP POST webhook
- URL from config:
  - `NODE_CALLBACK_BASE_URL`
  - `GENERATE_CALLBACK_PATH` (default `/ai/callback/generate-complete`)

Success callback:

```ts
interface GenerationCallbackSuccess {
  requestId: string;
  status: "succeeded";
  finishedAt: string;
  result: {
    postId: string | null;
    variations: GeneratedVariation[];
    model: string | null;
    pipeline: unknown[];
  };
  meta: {
    userId: string | null;
    topic: string;
    tones: string[];
    sourceRequestId: string;
  };
}
```

Failure callback:

```ts
interface GenerationCallbackFailed {
  requestId: string;
  status: "failed";
  finishedAt: string;
  error: { code: string; message: string; stage: string };
  meta: { userId: string | null; topic: string; tones: string[]; sourceRequestId: string };
}
```

## 6) Node Callback -> DB Persistence

- Callback receiver:
  - Route: `backend/src/routes/ai.routes.js` (`POST /ai/callback/generate-complete`)
  - Handler: `backend/src/controllers/ai.controller.js::generateCompleteCallbackHandler`
  - Validation: `generateCompleteCallbackSchema`

- Persistence logic:
  - On success, if `result.postId` missing and callback contains user + 2 variations:
  - Call `backend/src/services/posts.service.js::persistGeneratedFromCallback`
  - Inject persisted `postId` back into callback payload before socket emit

DB structures involved:
- `backend/migrations/001_init.sql`
  - `posts(id, user_id, topic, tone, generated_text, image_prompt, image_url, status, published_at, ...)`
- `backend/migrations/003_post_selection.sql`
  - added `selected_variation_id`, `selected_text`
  - added enum value `'selected'`

Status transitions:
- callback persist -> `draft`
- variation pick (`selectVariation`) -> `selected`
- accepted feedback (`processFeedback`) -> `published`
- rejected feedback (`processFeedback`) -> `rejected`

## 7) Node -> Frontend via Socket.io

- Socket server setup: `backend/src/index.js`
  - creates Socket.io server
  - uses `socketAuth`
  - registers `setupSocketGenerationRoomHandlers` (`backend/src/services/socketGenerationRooms.js`)

- Room protocol:
  - frontend emits `"join_generation"` with `{ requestId }`
  - backend joins room `generation:${requestId}`

- Event emission:
  - from `generateCompleteCallbackHandler`
  - event: `"generation_lifecycle"`
  - payload: callback payload (success/failure), possibly with injected `result.postId`

- Frontend listener:
  - `frontend/src/hooks/useGenerationSocket.ts`
  - listens to `"generation_lifecycle"`
  - forwards to `GeneratorPage::onGenerationEvent`

- UI update on completion:
  - stop waiting state
  - on failed: show error
  - on success: set two variations, set `postId`, open `VariationPickerModal`

## 8) ASCII Flow

`TopicForm.tsx` -> `GeneratorPage.tsx::onGenerateAi` -> `frontend/src/api/generate.ts::generateMockPosts`  
-> `backend/src/routes/ai.routes.js POST /ai/generate` -> `ai.controller.js::generateTweetHandlerPersist`  
-> `aiClient.service.js::startGenerateDraftJob` -> `ai-service/routes/generate.py::generate_async`  
-> `ai-service/routes/generate.py::_run_generate_job` -> `ai-service/routes/generate.py::_post_generate_callback`  
-> `ai.controller.js::generateCompleteCallbackHandler` -> `posts.service.js::persistGeneratedFromCallback`  
-> `Socket event generation_lifecycle` -> `frontend/src/hooks/useGenerationSocket.ts` -> `GeneratorPage.tsx::onGenerationEvent`
