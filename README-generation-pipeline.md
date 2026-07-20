# Generation Flow (Frontend + Backend + AI Service)

A compact end-to-end reference for how Post generation works in this repository.

## 1) Frontend request

Source: `design-guide/src/api/generate.ts`

Client call:
- `generateMockPosts(body)` → `POST /ai/generate`
- `selectPostVariation(postId, body)` → `POST /posts/:id/select-variation`
- `publishPost(postId, "linkedin")` → `POST /connections/posts/:id/publish`

Request body for generation:

```ts
export type GenerateMockPostsBody = {
  topic: string;
  tones: [string, string];
  reworkBaseText?: string;
  reworkInstructions?: string;
  sourcePostId?: string;
  sourceVariationId?: 1 | 2;
  modelProvider?: "openai" | "groq" | "ollama";
  modelName?: string;
};
```

Response type:

```ts
export type GenerateStartResponse = {
  ok: true;
  status: "started";
  requestId: string;
  message: string;
  insights?: GenerateInsights;
};
```

The UI sends exactly one API call to `/ai/generate` and then waits for the async socket callback.

## 2) Backend Node.js behavior

Route: `POST /ai/generate`
- files: `backend/src/routes/ai.routes.js`, `backend/src/controllers/ai.controller.js`, `backend/src/validations/ai.validations.js`
- `requireUserId` is applied when the database is enabled.
- Request body is validated with `generateTweetBodySchema`.

Validation rules:
- `topic`: string, max 200, min 3 unless rework mode.
- `tones`: exactly 2 unique strings, max 40 chars each.
- `reworkBaseText`: optional string, max 280.
- `reworkInstructions`: optional string, max 400.
- `sourcePostId`: optional UUID.
- `sourceVariationId`: optional 1 or 2 (required when rework is present).
- `modelProvider`: optional `openai | groq | ollama`.
- `modelName`: optional string, max 128.

Backend transforms the request and proxies it to the AI worker:

```js
{
  topic,
  tones,
  profession: null,
  audience: null,
  vibe: null,
  rework_base_text,
  rework_instructions,
  user_id,
  model_provider,
  model_name,
}
```

Backend response:
- `202 Accepted`
- body: `{ ok: true, status: "started", requestId, message, insights }`

Callback route: `POST /ai/callback/generate-complete`
- validates `generateCompleteCallbackSchema`
- emits Socket.IO event `generation_lifecycle` to room `generation:{requestId}`
- if `status === "succeeded"` and `userId` exists, may persist the generated post
- returns `202 { ok: true }`

Callback success payload:

```ts
{
  requestId: string;
  status: "succeeded";
  finishedAt: string; // ISO datetime
  result: {
    postId?: string | null;
    variations: Array<{ variation_id: number; text: string; tone_applied?: string; estimated_length?: string; hashtags?: string[]; image_base64?: string | null }>;
    model?: string | null;
    pipeline?: unknown;
  };
  meta?: { userId?: string | null; topic?: string; tones?: string[]; sourceRequestId?: string };
}
```

Callback failure payload:

```ts
{
  requestId: string;
  status: "failed";
  finishedAt: string;
  error: { code: string; message: string; stage?: string };
  result?: Record<string, unknown>;
  meta?: { userId?: string | null; topic?: string; tones?: string[]; sourceRequestId?: string };
}
```

## 3) AI service behavior

Source: `ai-service/app/routes/generate.py`, `ai-service/app/core/*.py`

Internal worker endpoint:
- `POST /generate-async`
- payload includes `topic`, `tones`, optional `profession`, `audience`, `vibe`, rework fields, `user_id`, `model_provider`, `model_name`.
- returns an async acknowledgement.

Worker flow:
1. Run text generation twice, once per tone.
2. Build structured tweet output with `TweetDraftOutput`.
3. Optionally derive `image_prompt` and generate image output.
4. POST completion to backend callback.

The backend may also call `POST /generate` synchronously in helper paths, but the main UI flow is async.

## 4) End-to-end sequence

1. Frontend `GeneratorView` calls `generateMockPosts(body)`.
2. Backend receives `POST /ai/generate`, validates payload, and proxies to the AI service.
3. Backend returns `202` immediately with `requestId`.
4. AI worker finishes generation and calls `POST /ai/callback/generate-complete`.
5. Backend emits `generation_lifecycle` over Socket.IO to room `generation:{requestId}`.
6. Frontend receives the socket event, shows two variations, and user picks one.
7. The selection is persisted via `POST /posts/:id/select-variation`.
8. Optional publish step uses `POST /connections/posts/:id/publish`.

## 5) Key payload types

Frontend request:
- `topic: string`
- `tones: [string, string]`
- `reworkBaseText?: string`
- `reworkInstructions?: string`
- `sourcePostId?: string`
- `sourceVariationId?: 1 | 2`
- `modelProvider?: "openai" | "groq" | "ollama"`
- `modelName?: string`

Backend callback success fields:
- `requestId`, `status`, `finishedAt`
- `result.postId?`
- `result.variations` with `variation_id`, `text`, optional `image_base64`
- `meta.userId?`, `meta.topic?`, `meta.tones?`

## 6) Where to look for code

- Frontend request layer: `design-guide/src/api/generate.ts`
- Frontend socket handling: `design-guide/src/hooks/useGenerationSocket.ts`
- Backend route: `backend/src/routes/ai.routes.js`
- Backend controller: `backend/src/controllers/ai.controller.js`
- Backend validation: `backend/src/validations/ai.validations.js`
- Backend AI client: `backend/src/services/aiClient.service.js`
- AI service route: `ai-service/app/routes/generate.py`
- AI generation chains: `ai-service/app/core/chains.py`, `ai-service/app/core/llm.py`, `ai-service/app/core/prompts.py`

## 7) Short note

This flow is designed as a single frontend API call to `/ai/generate`, with the actual text generation handled asynchronously by the Python worker and results delivered by callback + Socket.IO. Keep UI state driven by `requestId`, not by direct LLM request/response timing.

