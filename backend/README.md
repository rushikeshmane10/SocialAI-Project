# Backend (Node.js) — Social Agent API

**Purpose:** HTTP API for the social-agent monorepo. This service **does not embed LLM prompts or chains**; it validates requests, **proxies generation to the Python `ai-service`** (OpenAI / LangChain / image steps live there), receives **webhook-style callbacks**, pushes **Socket.IO** updates to the browser, persists **Postgres** when enabled, posts tweets to X with **server-only** credentials, and returns stable JSON to the React app.

**Stack:** Node 20+, **Express 4**, **Socket.IO**, **Sequelize 6** (Postgres), plain **JavaScript** (ESM), **Zod** (env + request validation), **fetch** to Python, **twitter-api-v2** for X.

---

## High-level design (system context)

```text
Browser (React)
       │  POST /ai/generate (202 + requestId)   Socket.IO generation:{requestId}
       │  POST /post/tweet
       ▼
  THIS SERVICE (Express + Socket.IO)  ← secrets: Twitter OAuth 1.0a, AI base URL
       │
       ├──► Python ai-service   POST {AI_SERVICE_URL}/generate-async  (ack + background job)
       │         │
       │         └──► callback POST /ai/callback/generate-complete  ──► emits generation_lifecycle
       │
       └──► Twitter API v2      (tweet text only; no media upload in MVP)
```

**Invariant:** The frontend never holds `OPENAI_*` or Twitter tokens. Only this backend (and the Python worker) hold service credentials as configured.

**Sync path (still in code):** [`aiClient.service.js`](src/services/aiClient.service.js) can call **`POST /generate`** for a full pipeline response (used by helpers such as `generateDraftVariations`); the **`POST /ai/generate`** route uses **`/generate-async`** today.

---

## Twitter (X) integration

This backend is the **only** place Twitter credentials live. The React app calls **`POST /post/tweet`** with plain tweet text; the server signs the request with **OAuth 1.0a (user context)** and calls **Twitter API v2** (`twitter-api-v2`).

### End-to-end flow

```text
Browser (React)                    This service (Express)
      │                                    │
      │  POST /post/tweet                  │
      │  { "text": "…" }                     │
      │  (no Twitter secrets)               │
      └────────────────────────────────────►│  post.controller.js
                                              │    → validates body (Zod)
                                              │    → twitter.service.js
                                              │         → TwitterApi (OAuth 1.0a)
                                              │         → client.readWrite.v2.tweet(text)
                                              │
      ◄──────────────────────────────────────┤  200 { tweetId, url }
      │  or 4xx/5xx + { error: { code, message } }
```

1. **Request:** `POST /post/tweet`, `Content-Type: application/json`, body `{ "text": string }`. Optional CORS preflight `OPTIONS` is allowed for `FRONTEND_ORIGIN`.
2. **Validation:** [`postTweetBodySchema`](src/validations/ai.validations.js) — `text` must be non-empty after trim and **at most 280 characters** (X limit).
3. **Configuration check:** If any of the four Twitter env vars is missing, the handler returns **503** with `code: TWITTER_NOT_CONFIGURED` (see [`twitterCredentialsConfigured`](src/config/env.js)).
4. **Post:** [`postTweet`](src/services/twitter.service.js) builds a `TwitterApi` client with app key/secret + user access token/secret, then calls **`rw.v2.tweet(text)`** (text-only; **no image upload** in this path).
5. **Response (success):** `{ "tweetId": "<id>", "url": "https://twitter.com/i/web/status/<id>" }`.
6. **Retries:** Up to **3 attempts** with backoff for **429** (rate limit) and **503** only; other errors fail immediately.

### Environment variables (Twitter)

Set these in **`backend/.env`** (never commit real values; copy from [`.env.example`](.env.example)).

| Variable | Role |
|----------|------|
| **`TWITTER_API_KEY`** | App / consumer **API Key** (public identifier for your X developer app). |
| **`TWITTER_API_SECRET`** | App / consumer **API Key Secret**. |
| **`TWITTER_ACCESS_TOKEN`** | **User** OAuth 1.0a **access token** (must be for a user allowed to post for that app). |
| **`TWITTER_ACCESS_SECRET`** | **User** OAuth 1.0a **access token secret**. |

All four must be set for posting to work. They are loaded in [`src/config/env.js`](src/config/env.js) and passed into [`twitter.service.js`](src/services/twitter.service.js).

**Related (not Twitter keys, but needed for the browser to call this API):**

| Variable | Role |
|----------|------|
| **`FRONTEND_ORIGIN`** | CORS allowlist (e.g. `http://localhost:5173`). The SPA origin must match or the browser blocks `POST /post/tweet`. |

### Code map (Twitter-only)

| Piece | File |
|--------|------|
| Route | [`src/routes/post.routes.js`](src/routes/post.routes.js) — `POST /post/tweet` |
| Route registration | [`src/routes/index.js`](src/routes/index.js) — `postTweetRouter` is mounted **without** `DATABASE_URL`; posting works even when Postgres is disabled or unreachable after startup warning. |
| HTTP handler | [`src/controllers/post.controller.js`](src/controllers/post.controller.js) |
| X API client + retries | [`src/services/twitter.service.js`](src/services/twitter.service.js) |
| Body schema | [`src/validations/ai.validations.js`](src/validations/ai.validations.js) — `postTweetBodySchema` |

### Error responses (stable `error.code`)

| HTTP | `error.code` | Typical cause |
|------|----------------|---------------|
| 400 | `VALIDATION_ERROR` | Empty or over-280-character `text`, or bad JSON. |
| 403 | `TWITTER_ERROR` | Often returned when X responds with **403 Forbidden** (see troubleshooting below). |
| 400 | `TWITTER_ERROR` | X rejected the payload (mapped from X **400**). |
| 502 | `TWITTER_ERROR` | X upstream or network issue after retries. |
| 503 | `TWITTER_NOT_CONFIGURED` | One or more `TWITTER_*` env vars unset. |

Message text comes from the thrown `TwitterServiceError` or validation details.

### X Developer Portal checklist (when you see 403 or “not allowed to post”)

- App has **Read and write** (or equivalent) permission if you intend to post tweets.
- You are using **OAuth 1.0a User context** tokens that match this app (regenerate tokens if you rotated keys).
- Your project/product access matches what you are calling (**Free** vs **Basic** tier affects which endpoints and volumes are allowed).
- Regenerate **Access Token & Secret** for the user after changing app permissions.

### Limits and scope

- **280 characters** per tweet (enforced in Zod before calling X).
- **Text only** — no media, threads, or polls in this endpoint.
- Secrets stay **server-side** only; the frontend sends **only** the tweet string.

---

## Architecture (folder layout)

Layered layout; keep handlers thin and side effects in services.

| Path | Role |
|------|------|
| [src/index.js](src/index.js) | Process entry: HTTP server from Express app, **Socket.IO** attach + auth, `listen` on `PORT`. |
| [src/createServer.js](src/createServer.js) | Build Express: **pino-http**, `errorHandler`, CORS, `requestId` middleware, register [routes/index.js](src/routes/index.js). |
| [src/routes/](src/routes/) | **Route map only.** [index.js](src/routes/index.js) mounts routers; each `*.routes.js` binds path → controller. |
| [src/controllers/](src/controllers/) | Parse/validate (or delegate validation), call services, send HTTP responses. |
| [src/services/](src/services/) | **aiClient.service.js** — HTTP client to Python (`startGenerateDraftJob` → `/generate-async`, `generateDraft` → `/generate`, `generateDraftVariations`). **socketGenerationRooms.js** — generation rooms. **twitter.service.js** — X posting. **auth**, **profile**, **posts**, **feedback**, **behaviorLearner** when DB is enabled. |
| [src/models/](src/models/) | Sequelize models (`User`, `UserProfile`, `Post`, `PostFeedback`, `UserBehavior`). |
| [src/db/](src/db/) | **sequelize.js** — Sequelize instance. **migrate.js** — ordered `migrations/*.sql` + `schema_migrations` table. |
| [migrations/](migrations/) | Versioned SQL (e.g. `001_init.sql`). |
| [src/validations/](src/validations/) | Zod schemas for request bodies (e.g. [ai.validations.js](src/validations/ai.validations.js)). |
| [src/middlewares/](src/middlewares/) | Cross-cutting: [requestContext.js](src/middlewares/requestContext.js) (`x-request-id`), [errorHandler.js](src/middlewares/errorHandler.js), [authenticate.js](src/middlewares/authenticate.js) (`requireUserId` / `X-User-Id`). |
| [src/utils/response.js](src/utils/response.js) | Shared `{ error: { code, message, details? } }` helpers. |
| [src/config/env.js](src/config/env.js) | **Fail-fast** env load with Zod (no silent misconfig). |

---

## How we connect to Python (ai-service)

### Async (used by `POST /ai/generate`)

1. **URL:** `AI_SERVICE_URL` (e.g. `http://127.0.0.1:8000`). Endpoint: **`POST /generate-async`** — returns **`{ accepted: true, request_id }`** quickly.
2. **Request body:** topic, two **`tones`**, optional profile / rework fields, optional **`user_id`** — see [aiClient.service.js](src/services/aiClient.service.js) `startGenerateDraftJob`.
3. **Headers:** `content-type: application/json`, **`x-request-id`** — propagated for log correlation with uvicorn/FastAPI.
4. **Timeout:** **`AI_SERVICE_TIMEOUT_MS`** (default **25s**) bounds only the **ack** call, not the full LLM run.
5. **Callback:** Python **`POST`**s to **`/ai/callback/generate-complete`** on this server (base URL must be reachable from the worker; configured on the Python side). Handler validates with Zod, returns **202**, emits **`generation_lifecycle`** on Socket.IO to room **`generation:{requestId}`**.
6. **Errors:** Failed ack → `AiServiceError` → **502/504** etc.; callback failures are delivered in the socket payload (see [ai.validations.js](src/validations/ai.validations.js) `generateCompleteCallbackSchema`).

### Sync `POST /generate` (helpers / tests)

1. **URL:** `new URL("/generate", AI_SERVICE_URL)`.
2. **Body:** `topic`, **`tone`** (single), optional profession/audience/vibe, rework fields — per FastAPI schema.
3. **Timeout:** **`AI_SERVICE_GENERATE_TIMEOUT_MS`** (default **120s**) — full tweet + optional image pipeline.
4. **Response:** JSON with **`post`**, **`image_prompt`**, **`image_url`**, **`image`** (`status` `ok` \| `failed` \| `skipped`, optional `code`/`message`), **`model`**. Partial success: HTTP 200 with `image.status === "failed"` can be passed through by callers.

**Errors (both patterns):** Network/5xx/timeout → `AiServiceError` → stable `code` values; no raw LLM traces to clients.

---

## HTTP API (this service)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness. |
| POST | `/auth/login` | No | `{ email, password }` → `{ userId }` (bcrypt check only; no tokens). |
| GET | `/profile` | Header `X-User-Id` | User profile + `dynamic_adjustments`. |
| POST | `/profile` | Header `X-User-Id` | `{ profession, audience, vibe }` upsert. |
| POST | `/preferences/log` | `X-User-Id` | `{ answers: Record<string, string> }` — validated and **logged only** (no DB write); max 20 keys. |
| POST | `/ai/generate` | `X-User-Id` if `DATABASE_URL` set | Starts Python **`/generate-async`**; responds **HTTP 202** with **`requestId`**, **`insights`**, and status message. Client joins Socket.IO room for completion. **Does not** synchronously create `posts` in the controller—wire [generateCompleteCallbackHandler](src/controllers/ai.controller.js) to persistence if you want auto-save (helpers in [posts.service.js](src/services/posts.service.js)). Without DB: same async path, **no** `X-User-Id`. |
| POST | `/ai/callback/generate-complete` | No (secure at network layer in prod) | Python completion webhook; validates body; **202**; emits **`generation_lifecycle`**. |
| GET | `/posts` | `X-User-Id` | `?limit=&cursor=` list current user’s posts. |
| GET | `/posts/:id` | `X-User-Id` | Single post (403/404 if not owner). |
| POST | `/posts/:id/select-variation` | `X-User-Id` | Pick variation 1 or 2; updates `posts`, logs `user_behavior`, `post_feedback`. |
| POST | `/posts/:id/satisfaction` | `X-User-Id` | Micro-survey after selection → `satisfaction_signals`, `user_behavior`, profile hints. |
| POST | `/posts/:id/feedback` | `X-User-Id` | `{ action, editedText?, metadata? }` — updates `post_feedback`, `user_profiles.dynamic_adjustments` (heuristics), and post `status` when accepted/rejected/edited. |
| POST | `/behavior/event` | `X-User-Id` | `{ event_type, payload? }` → `user_behavior`. |
| POST | `/post/tweet` | No | Body: `{ text }`. Posts to X (OAuth 1.0a env vars required). |

**CORS:** `FRONTEND_ORIGIN` (single origin for MVP).

---

## Database (Supabase Postgres)

See **[`SUPABASE.md`](SUPABASE.md)** for Supabase connection strings, how **`src/db/sequelize.js`** resolves DNS/TLS, and troubleshooting (**ENOTFOUND**, pooler, IPv6).

When **`DATABASE_URL`** is set:

- Migrations run on startup if **`RUN_MIGRATIONS_ON_START`** is true (default **true** in `development`, otherwise set explicitly). In production, prefer `npm run db:migrate` in CI and set `RUN_MIGRATIONS_ON_START=false` to avoid multi-instance races.
- Tables: `users`, `user_profiles`, `posts`, `post_feedback`, `user_behavior` (+ enums, indexes, FKs with `ON DELETE CASCADE`).
- **No signup API.** Apply `migrations/001_init.sql` then `migrations/002_seed_user.sql` (or run `npm run db:migrate`). The seed file creates user **`you@local.dev`** / password **`changeme`** with fixed id `00000000-0000-4000-8000-000000000001` (edit the migration to change email or hash). Regenerate a bcrypt hash:  
  `node -e "import('bcrypt').then(m=>m.default.hash('yourpassword',11).then(console.log))"` from the `backend` directory.

Manual migrate: `npm run db:migrate` (requires `DATABASE_URL`).

## Environment variables

Copy [.env.example](.env.example) → `.env`. Required for full behavior:

- **Always:** `AI_SERVICE_URL`, `FRONTEND_ORIGIN`
- **DB mode:** `DATABASE_URL` (production **required**)
- **Generate:** `AI_SERVICE_TIMEOUT_MS` (ack to `/generate-async`), `AI_SERVICE_GENERATE_TIMEOUT_MS` (full **`/generate`** sync calls / slow pipeline)
- **Posting to X:** `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET` — see [Twitter (X) integration](#twitter-x-integration) for flow, error codes, and portal checklist.

---

## Scripts

```bash
npm install
npm run dev      # node --watch src/index.js
npm start        # node src/index.js
npm run db:migrate  # apply migrations/sql (needs DATABASE_URL)
npm test         # node:test + supertest; loads test/env-globals.js first
```

---

## Practices (for maintainers and LLM agents)

1. **No AI logic in Node** — prompts, chains, and image generation stay in Python; Node only transports JSON and maps errors.
2. **Secrets** — never in frontend env (`VITE_*`); Twitter + service URLs live here only.
3. **Validation** — Zod at the edge; Python validates again; fail fast on bad env in [config/env.js](src/config/env.js).
4. **Errors** — consistent envelope via [utils/response.js](src/utils/response.js); controllers catch domain errors (`AiServiceError`, `TwitterServiceError`) and set status + body.
5. **Observability** — `requestId` on requests; AI controller logs generation **accept** and **callback** lifecycle (success vs failed payloads).
6. **Posting contract** — `/post/tweet` sends exactly the text the user approved in the UI (length validated; no server-side rewrite).
7. **Tests** — [test/](test/) uses `test/env-globals.js` so `env` loads before importing `createServer`; covers health, validation, Twitter-not-configured, and AI response parsing helpers.

When extending: add route → controller → service; add Zod schema in `validations/`; keep request/response JSON aligned with the frontend; update Python and frontend in lockstep for `/ai/generate` and callback payload shapes.

**Frontend with DB mode:** call `POST /auth/login`, store `userId` (e.g. `localStorage`), then send header **`X-User-Id: <uuid>`** on protected routes. This is identification only (not a security boundary) — fine for local learning.

Monorepo stack overview: [../README-overview.md](../README-overview.md).