# Social AI — short overview

Demo app for **sign-in**, **profile/preferences**, **AI-assisted tweet drafts** (two tones), **picking a variation**, **feedback**, and optional **X posting**. Data is keyed by user id (`X-User-Id` after login).

---

## Current situation

| Part | Stack | Runs as |
|------|--------|--------|
| **Frontend** | React 19 + Vite + TypeScript | Browser SPA |
| **Backend** | Node.js (Express) + Socket.IO + Sequelize (Postgres when enabled) | API + real-time |
| **AI service** | Python (FastAPI) + LangChain-style pipelines | Separate HTTP service (`AI_SERVICE_URL`, default `http://127.0.0.1:8000`) |

Generation is **asynchronous**: the backend asks Python to start a job; Python finishes work in the background and **calls back** into Node; the UI can follow progress via **Socket.IO** (room keyed by the worker `requestId`).

---

## Flow (happy path)

1. **React** — User logs in; client stores `userId` and sends **`X-User-Id`** on API calls. User submits topic + two tones → **`POST /ai/generate`** on the Node backend.
2. **Node** — Validates the request, forwards to Python **`POST /generate-async`**, gets **`202`-style acknowledgement** with a **`request_id`**, returns **`202`** to the client with that id (and quick **insights** from Node helpers for UX).
3. **Python** — Runs LLM chains (draft + optional image path), then **`POST`**s completion to Node **`/ai/callback/generate-complete`** with success or failure payload.
4. **Node** — Callback handler validates payload and **`emit`s** `generation_lifecycle` on Socket.IO to **`generation:{requestId}`**.
5. **React** — Subscribes to the socket room for that `requestId` and updates UI when the job completes (then uses existing posts/profile routes as needed).

**Implementation note:** The Node **`/ai/callback/generate-complete`** handler currently validates the payload and **broadcasts on Socket.IO**; writing **`posts`** / **`user_behavior`** on success is implemented in **`backend/src/services/posts.service.js`** (`mockGenerateAndPersist`) but is **not** wired from that callback yet—connect them if you want drafts saved automatically when Python finishes.

With **Postgres disabled**, the same generate path can run without persisting a user row (legacy handler without `X-User-Id` requirement).

---

## Who does what

### React (`frontend/`)

- Pages and forms (topic, tones, variation pick, feedback).
- HTTP to the **Node** API; **`socket.io-client`** for generation lifecycle events.
- No direct calls to the Python service from the browser in the intended setup.

### Node.js (`backend/`)

- **Public API**: auth, profile, posts, behavior events, AI proxy endpoints, Twitter post route where configured.
- **Orchestration**: calls Python (`/generate-async`, and sync `/generate` helpers where still used in code paths).
- **Callback URL**: Python must be configured with a base URL that reaches this server for **`/ai/callback/generate-complete`**.
- **Persistence**: Sequelize models, migrations, user-linked **`posts`**, **`user_behavior`**, feedback tables (when `DATABASE_URL` is set).
- **Real-time**: Socket.IO server (CORS toward frontend origin).

### Python (`ai-service/`)

- **FastAPI** app: **`/health`**, **`/generate`**, **`/generate-async`** (and related schemas).
- **LLM work**: prompt chains for tweet text (and visual prompt / image integration where enabled).
- **Async pattern**: accept job → process → HTTP callback to Node with structured result or error.

---

## Related docs

- [README.md](./README.md) — data model, capture matrix, API route summary, table columns (kept in sync with async generate + overview).
- [backend/README.md](./backend/README.md) — how this service runs, Python proxy (`/generate-async`, `/generate`), callback + Socket.IO, Twitter posting, env and scripts.
