# Composio publish flow (backend)

Short reference for posting a **selected** draft to LinkedIn or Twitter/X via [Composio](https://composio.dev) from the Node backend.

> **Note:** Publish does **not** call the Python `ai-service`. The backend uses `@composio/core` directly. `ai-service` only generates draft text/images upstream; see `ai-service/README.md` → **Publish (Composio)**.

> **Debugging this flow?** See [COMPOSIO_PUBLISH_FIXES.md](COMPOSIO_PUBLISH_FIXES.md) for the specific runtime failures found against the live Composio API and why the code below looks the way it does (version-check requirement, env var split, the `File`-based image upload).

## End-to-end flow

```
Frontend (design-guide / frontend)
  POST /connections/posts/:id/publish  { platform }
       │
       ▼
backend/src/controllers/connections.controller.js  →  publishPost
       │
       ▼
backend/src/services/composio.service.js  →  executePost
       │
       ▼
Composio SDK (@composio/core)  →  LinkedIn / Twitter tools
```

**Prerequisites:** user OAuth via `/connections/*`, post `status === "selected"`, non-empty `selected_text`, platform connected on `users` row.

---

## Frontend call

| File | Symbol |
|------|--------|
| `design-guide/src/api/client.ts` | `publishPost(postId, platform)` |
| `design-guide/src/components/GeneratorView.tsx` | calls `publishPost(postId, "linkedin")` |
| `frontend/src/api/client.ts` | same API helper |
| `frontend/src/pages/GeneratorPage.tsx` | same trigger |

```ts
// design-guide/src/api/client.ts
publishPost(postId: string, platform: "linkedin" | "twitter")
// → POST {baseUrl}/connections/posts/{postId}/publish
// → body: { platform }
// → headers: content-type: application/json, X-User-Id: <uuid>
```

Base URL: `VITE_API_BASE_URL` (default `http://localhost:3001`).

---

## Publish route

| Item | Value |
|------|--------|
| **Method / path** | `POST /connections/posts/:id/publish` |
| **Route file** | `src/routes/connections.routes.js` |
| **Handler** | `publishPost` in `src/controllers/connections.controller.js` |
| **Auth** | `requireUserId` → header `X-User-Id` (UUID) |

### Request

| Part | Type | Required | Description |
|------|------|----------|-------------|
| `:id` | path (UUID) | yes | Post id |
| `platform` | body string | yes | `"linkedin"` or `"twitter"` |
| `X-User-Id` | header | yes | Current user UUID |

```json
{ "platform": "linkedin" }
```

### Success response (`200`)

```json
{
  "success": true,
  "platform": "linkedin",
  "postId": "optional-external-id-from-composio"
}
```

### Error response

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | FORBIDDEN | INVALID_STATE | NOT_CONNECTED | COMPOSIO_POST_FAILED | ...",
    "message": "Human-readable message"
  }
}
```

### Handler checks

1. `body.platform` is `linkedin` or `twitter`
2. Post exists, `post.user_id` matches `X-User-Id`
3. `post.status === "selected"` and `selected_text` is non-empty
4. `users.linkedin_connected` or `users.twitter_connected` is true for the platform
5. Calls `executePost(composioEntityId, platform, post.selected_text, post.selected_image_base64 ?? null)`

`composioEntityId` = `users.composio_entity_id` if set, else `userId`.

---

## Composio service

| File | Role |
|------|------|
| `src/services/composio.service.js` | OAuth helpers + `executePost` |
| `src/config/env.js` | `composioConfigured()`, Composio env vars |

### `executePost(userId, platform, text, imageBase64?)`

| Platform | Composio tools | Notes |
|----------|----------------|-------|
| **LinkedIn (text)** | `LINKEDIN_GET_MY_INFO` → `LINKEDIN_CREATE_LINKED_IN_POST` | Resolves author URN from profile |
| **LinkedIn (image)** | Same author step → `LINKEDIN_CREATE_LINKED_IN_POST` (single call) | Image from `posts.selected_image_base64`, compressed with `sharp`, passed as an in-memory `File` in `images`. The SDK's `autoUploadDownloadFiles: true` (set in `getClient`) uploads it and builds the `FileUploadable` dict the tool requires. |
| **Twitter** | `TWITTER_CREATE_TWEET` | `{ text }` only |

**Why no separate upload step:** an earlier version of this flow called `LINKEDIN_REGISTER_IMAGE_UPLOAD`, PUT the JPEG to the returned presigned URL, then passed the resulting `asset_urn` string into `LINKEDIN_CREATE_LINKED_IN_POST`'s `images` field. Confirmed live against the current tool schema (version `20260707_00`) that this now fails: `images` validates server-side as a `FileUploadable` dict, and a raw asset-URN string is rejected with `"Input should be a valid dictionary or instance of FileUploadable"`. Passing a `File` with auto-upload enabled is the form Composio's backend currently accepts.

DB fields used at publish time:

- `posts.selected_text` — caption/body sent to Composio
- `posts.selected_image_base64` — optional data URL or raw base64 (LinkedIn only)

---

## OAuth / connection routes (before publish)

| Method | Path | Handler | File |
|--------|------|---------|------|
| `GET` | `/connections/status` | `getConnectionStatus` | `connections.controller.js` |
| `POST` | `/connections/:platform/initiate` | `initiateConnection` | returns `{ redirectUrl, connectionId }` |
| `GET` | `/connections/:platform/callback` | `connectionCallback` | sets `twitter_connected` / `linkedin_connected` |

`:platform` = `twitter` | `linkedin`.

Migration: `migrations/007_composio_connections.sql` (`users.composio_entity_id`, connection flags).

---

## Environment variables

Set in `backend/.env` (see `.env.example`):

| Variable | Required | Purpose |
|----------|----------|---------|
| `COMPOSIO_API_KEY` | yes | Composio SDK |
| `COMPOSIO_LINKEDIN_AUTH_CONFIG_ID` | yes (LinkedIn) | Auth config id (`ac_xxxx`) for OAuth. No production author-URN override exists — `executePost` always resolves the author URN per-user via `LINKEDIN_GET_MY_INFO`. |
| `COMPOSIO_TWITTER_AUTH_CONFIG_ID` | yes (Twitter) | Auth config id for OAuth |
| `COMPOSIO_LINKEDIN_IMAGE_MAX_BYTES` | no | JPEG size cap (default `900000`) |
| `COMPOSIO_LINKEDIN_IMAGE_MAX_EDGE` | no | Max resize edge px (default `1600`) |
| `COMPOSIO_LINKEDIN_IMAGE_JPEG_QUALITY_START` | no | Initial JPEG quality (default `82`) |
| `COMPOSIO_ENTITY_ID` | test only | User id for `POST /test/linkedin-image-post` |

Routes mount only when `DATABASE_URL` is set (`src/routes/index.js`). Without `COMPOSIO_API_KEY`, Composio calls return `503` / `COMPOSIO_NOT_CONFIGURED`.

**SDK note (`@composio/core` 0.6.11):** `composio.tools.execute(...)` throws `ComposioToolVersionRequiredError` unless a toolkit version is pinned or `dangerouslySkipVersionCheck: true` is passed per call — this SDK version resolves an unset toolkit version to `"latest"` and refuses to run it. All manual tool executions in `composio.service.js` pass `dangerouslySkipVersionCheck: true` for this reason. Trade-off: this accepts whatever toolkit version Composio currently serves rather than pinning one, so a future breaking schema change from Composio would surface at runtime instead of at upgrade time — pin `toolkitVersions` on the client instead if that trade-off is undesirable.

---

## Test endpoint

| Method | Path | File |
|--------|------|------|
| `POST` | `/test/linkedin-image-post` | `src/routes/test.routes.js` → `test.controller.js` |

Uses `testLinkedinImagePostViaComposio` (same `executePost` path as production). Optional env `COMPOSIO_TEST_IMAGE_BASE64`.

---

## Related files (quick index)

```
backend/
├── src/routes/connections.routes.js      # publish + OAuth routes
├── src/controllers/connections.controller.js
├── src/services/composio.service.js      # executePost, OAuth
├── src/config/env.js
├── src/middlewares/authenticate.js       # X-User-Id
├── migrations/007_composio_connections.sql
├── migrations/008_selected_image_base64.sql
└── .env.example
```
