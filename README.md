# Social AI (demo monorepo)

## Project summary

This repo is a full-stack social post generation demo with three main layers:

- **Frontend:** React + Vite UI where users sign in, set preferences, generate drafts, choose a final version, and give feedback.
- **Backend:** Node/Express API with Sequelize + Postgres persistence for auth, profiles, posts, feedback, and behavior signals.
- **AI service:** Python FastAPI worker that generates tweet drafts and optional image prompts using LangChain with OpenAI or Ollama.

The application is built to capture user-level signals at every step so the experience can later be personalized and analyzed.

## Workflow

1. User logs in via `POST /auth/login`.
2. The client stores the returned `userId` and sends it on every request as `X-User-Id`.
3. The user saves profile/preferences and requests content generation.
4. The backend forwards generation requests to the AI worker via `/generate-async`.
5. The AI worker runs two generation tones, validates structured output, optionally generates an image prompt, and posts results back to the Node callback endpoint.
6. The frontend shows generated variations; the user selects one and optionally publishes or rates satisfaction.
7. All actions create persisted records in Postgres: `posts`, `post_feedback`, `satisfaction_signals`, and `user_behavior`.

## High-level design

- **User-facing UI (`frontend/`):** localStorage-based user session, API calls to backend, interactive generation flow.
- **API & persistence (`backend/`):** Express routes handle auth, profile/preferences, post generation, selection, feedback, and behavior logging.
- **AI generation worker (`ai-service/`):** FastAPI app that isolates LLM logic, generates text and image prompts, and returns results asynchronously.
- **Data flow:** frontend → backend → ai-service → backend → frontend.
- **Identity flow:** `X-User-Id` header links all persisted rows to the same user without a JWT-heavy flow.

## Low-level design

- **Backend implementation:** `backend/src/controllers/` hold request handlers; `backend/src/db/` manages Sequelize and migrations; `backend/src/helpers/` provides insight extraction and mock generation utilities.
- **AI worker implementation:** `ai-service/app/core/` defines configuration, LLM factory, prompt chains, and model settings; `ai-service/app/routes/generate.py` manages generation endpoints and callback delivery.
- **Persistence schema:** `users`, `user_profiles`, `posts`, `post_feedback`, `satisfaction_signals`, and `user_behavior` capture profile state, content drafts, selection decisions, satisfaction labels, and event telemetry.
- **Async coordination:** Python worker uses `NODE_CALLBACK_BASE_URL` and `GENERATE_CALLBACK_PATH` to notify Node when generation completes; Node then updates the user-facing flow.
- **Optional image support:** `IMAGE_PROVIDER` controls whether the visual prompt step generates an image URL through OpenAI or skips image generation.

## What this is & why we store user data

**Goal:** A demo app where a user signs in (email/password), saves **preferences**, runs an **AI-backed generate** flow (Node → Python **`/generate-async`**, two tones, **Socket.IO** lifecycle; quick insights still computed in Node), **picks** a variation to persist, and optionally **posts to X** using server-only Twitter credentials. Stack summary: [`README-overview.md`](README-overview.md).

**Why we capture user data:** Everything below is keyed by **`users.id`** so you can later train models, personalize tone, measure engagement, or audit activity **per person** without mixing users. The browser stores **`userId`** after login and sends **`X-User-Id`** on API calls (no JWT in this demo).

**Future use (ML / personalization):** Rich signals live in **`user_behavior.payload`** (topic-level features at generate time) and **`user_profiles.dynamic_adjustments`** (rolling hints from feedback). **`posts`** holds raw topics, tones, full variation JSON, and the user’s final pick. **`post_feedback`** records discrete actions with structured **`metadata`**.

---

## How user data is captured (end-to-end)

| Step | Where it happens | What is captured |
|------|------------------|-------------------|
| Login | `POST /auth/login` | Validates credentials; client stores returned **`userId`** (UUID). |
| Every authenticated API call | Request header **`X-User-Id`** | Backend resolves all reads/writes to that user (never trust a `userId` in JSON body for auth). |
| Preferences | `POST /preferences/log` | Questionnaire answers → **`user_profiles`** (`profession`, `audience`, `vibe`). |
| Profile API | `GET` / `POST /profile` | Reads or upserts the same profile row. |
| Generate (async) | `POST /ai/generate` | Node forwards to Python **`/generate-async`**; **`202`** with `requestId`; Python calls **`/ai/callback/generate-complete`**; Node emits Socket.IO **`generation_lifecycle`** (see **`README-overview.md`** for stack note on DB persistence). |
| Pick variation | `POST /posts/:id/select-variation` | Updates **`posts`** (`status`, `selected_variation_id`, `selected_text`); logs **`user_behavior`** (`variation_selected`); inserts **`post_feedback`** (`accepted` + metadata); refreshes **`user_profiles.dynamic_adjustments`**. |
| Satisfaction micro-survey | `POST /posts/:id/satisfaction` | After a variation is **selected**, one-tap **`yes` / `almost` / `not_really`** → **`satisfaction_signals`** row + **`user_behavior`** (`satisfaction_signal`) + merged **`user_profiles.dynamic_adjustments`** (`satisfaction_tally`, `satisfaction_rate`, `last_signal`). |
| Classic feedback | `POST /posts/:id/feedback` | **`post_feedback`** + profile hint refresh; may change **`posts.status`** (e.g. published/rejected). |
| Custom UI events | `POST /behavior/event` | Arbitrary **`user_behavior`** row from the client (`event_type` + `payload`). |

**Not stored in Postgres:** Tweet text for `POST /post/tweet` is not persisted as a row in this schema (only the live Twitter call). If you need a history table, add a migration later.

---

## API routes (summary)

Assumes **`DATABASE_URL`** is set and the DB connects at startup (otherwise DB-backed routes are not mounted).

| Method | Path | User-linked data |
|--------|------|------------------|
| `GET` | `/health` | None |
| `POST` | `/auth/login` | Reads **`users`** |
| `GET` / `POST` | `/profile` | **`user_profiles`** |
| `POST` | `/preferences/log` | **`user_profiles`** |
| `GET` | `/posts`, `GET /posts/:id` | **`posts`** |
| `POST` | `/posts/:id/select-variation` | **`posts`**, **`user_behavior`**, **`post_feedback`**, **`user_profiles`** |
| `POST` | `/posts/:id/satisfaction` | **`satisfaction_signals`**, **`user_behavior`**, **`user_profiles`** |
| `POST` | `/posts/:id/feedback` | **`posts`**, **`post_feedback`**, **`user_profiles`** |
| `POST` | `/behavior/event` | **`user_behavior`** |
| `POST` | `/ai/generate` | Starts Python async job (HTTP **202**); callback + socket today; **`user_behavior`** / **`posts`** rows from generate depend on wiring callback → persist layer (see **`README-overview.md`**). |
| `POST` | `/post/tweet` | No DB row (Twitter only) |

---

## Table structure (columns & purpose)

All user-owned rows reference **`users.id`** (`uuid`) unless noted.

### `users`

| Column | Type | Captures |
|--------|------|----------|
| `id` | uuid PK | Stable user id (used as `X-User-Id`). |
| `email` | text, unique | Login identifier (normalized on login). |
| `password_hash` | text | Bcrypt hash or demo plain value (see backend auth). |
| `created_at`, `updated_at` | timestamptz | Account lifecycle. |

### `user_profiles` (one row per user)

| Column | Type | Captures |
|--------|------|----------|
| `id` | uuid PK | Profile row id. |
| `user_id` | uuid FK → `users.id`, unique | Owner. |
| `profession`, `audience`, `vibe` | text | Self-reported preferences / questionnaire. |
| `dynamic_adjustments` | jsonb | **Derived:** merged from **`post_feedback`** (accept/reject/edit/regenerate heuristics) and **`satisfaction_signals`** flows (`satisfaction_tally`, `satisfaction_rate`, `last_signal`, `last_signal_at`). Good for personalization / ML features. |
| `created_at`, `updated_at` | timestamptz | Last update times. |

### `posts`

| Column | Type | Captures |
|--------|------|----------|
| `id` | uuid PK | Post id (returned as `postId` from generate). |
| `user_id` | uuid FK → `users.id` | Owner. |
| `topic` | text | Raw topic string from generate form. |
| `tone` | text | Optional tone string from form. |
| `generated_text` | text | JSON string `{ "version": 1, "variations": [ ... ] }` (two objects: `variation_id`, `text`, …) when persisted from the Python-backed path; legacy rows may be plain text. |
| `image_prompt`, `image_url` | text | Optional image pipeline fields from the AI service when used. |
| `status` | enum | `draft` → user may pick; **`selected`** after pick; `published` / `rejected` from feedback flow. |
| `published_at` | timestamptz | Set when feedback marks accepted as published (classic path). |
| `selected_variation_id` | int, nullable | Which variation (1 or 2) the user picked. |
| `selected_text` | text, nullable | Final chosen tweet text. |
| `created_at`, `updated_at` | timestamptz | Timestamps. |

*Migration [`backend/migrations/003_post_selection.sql`](backend/migrations/003_post_selection.sql) adds `selected` to the `post_status` enum and the `selected_*` columns.*

### `satisfaction_signals` (one row per user per post)

| Column | Type | Captures |
|--------|------|----------|
| `id` | uuid PK | Signal row id. |
| `post_id` | uuid FK → `posts.id` | Post the user is rating (must be **`selected`** when recorded). |
| `user_id` | uuid FK → `users.id` | Owner. |
| `signal` | text (`yes` \| `almost` \| `not_really`) | High-value personalization label. |
| `variation_id` | int, nullable | Which variation was picked (`posts.selected_variation_id` snapshot). |
| `selected_text` | text, nullable | Chosen text snapshot. |
| `context` | jsonb | Snapshot: `topic`, `tone`, `post_status`, `selected_variation_id`, `signaled_at`. |
| `created_at` | timestamptz | When the user answered. |

**Constraint:** `UNIQUE (user_id, post_id)` — at most one satisfaction answer per post per user (idempotent repeats return 200).

*Migration [`backend/migrations/004_satisfaction_signal.sql`](backend/migrations/004_satisfaction_signal.sql).*

### `post_feedback`

| Column | Type | Captures |
|--------|------|----------|
| `id` | uuid PK | Row id. |
| `post_id` | uuid FK → `posts.id` | Which post. |
| `user_id` | uuid FK → `users.id` | Who acted (same as post owner in normal flows). |
| `action` | enum | `accepted` \| `rejected` \| `edited` \| `regenerated`. |
| `edited_text` | text | New text when `action = edited`. |
| `metadata` | jsonb | **Extensible:** e.g. variation pick uses `{ "variation_id": 1, "selection_method": "manual_pick" }`. Use for ML labels / UI funnels. |
| `created_at` | timestamptz | When the action happened. |

### `user_behavior` (append-only event stream)

| Column | Type | Captures |
|--------|------|----------|
| `id` | uuid PK | Event id. |
| `user_id` | uuid FK → `users.id` | Who triggered the event. |
| `event_type` | text | Short label (see below). |
| `payload` | jsonb | **Arbitrary structured JSON** for analytics / future models. |
| `created_at` | timestamptz | Event time. |

**Built-in `event_type` values written by the server today**

| `event_type` | When | Typical `payload` fields (for ML / personalization) |
|--------------|------|--------------------------------------------------------|
| `generate_insight` | After generate when persist-on-success is wired (see **`README-overview.md`**) | `keywords`, `detected_tone`, `post_length_preference`, `topic_category`, `word_count`, `char_count`, `has_question`, `has_hashtag_intent`, `extracted_at`, plus **`topic`**, **`tone`** (original strings). |
| `variation_selected` | After `POST /posts/:id/select-variation` | `post_id`, `variation_id`, `selected_text`, `rejected_variation_id`. |
| `satisfaction_signal` | After `POST /posts/:id/satisfaction` | `post_id`, `signal`, `variation_id`, `topic`, `tone`, `selected_text`, `signal_id`. |

**Client-driven:** `POST /behavior/event` can insert any `event_type` + `payload` you define for product analytics.

---

## Relationships (FK overview)

```
users (id PK)
  │
  ├──1── user_profiles (user_id UNIQUE → users.id, ON DELETE CASCADE)
  │
  ├──*── posts (user_id → users.id, ON DELETE CASCADE)
  │         │
  │         ├──*── post_feedback (post_id → posts.id; user_id → users.id, CASCADE)
  │         │
  │         └──*── satisfaction_signals (post_id → posts.id, CASCADE)
  │
  └──*── user_behavior (user_id → users.id, ON DELETE CASCADE)
```

- Deleting a **user** cascades to profile, posts, feedback, satisfaction signals, and behavior rows.

---

## Repo layout

| Folder | Role |
|--------|------|
| `frontend/` | React + Vite SPA (`localStorage` user id, `X-User-Id` on requests). |
| `backend/` | Express + Sequelize + Postgres; insight helpers under `backend/src/helpers/`. |
| `backend/migrations/` | Versioned SQL (`001_init.sql`, `002_seed_user.sql`, `003_post_selection.sql`, `004_satisfaction_signal.sql`, …). |
| `ai-service/` | Python FastAPI worker; Node calls `/generate-async`; callbacks to Node. |

More operational detail: [`backend/README.md`](backend/README.md). **Stack & flow (short):** [`README-overview.md`](README-overview.md).

Detailed generation internals (text + image pipeline, params, models, tools, callback/socket flow): [`README-generation-pipeline.md`](README-generation-pipeline.md).
