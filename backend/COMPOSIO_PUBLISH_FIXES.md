# Composio publish flow — fix log (2026-07-17)

This documents what was actually broken in the LinkedIn/Twitter publish flow and what changed to
fix it. None of this was in `main` before — the flow looked plausible in code review but failed at
runtime in several different ways that only showed up when exercised against the live Composio API
(`@composio/core` `0.6.11`). Kept separate from [COMPOSIO_PUBLISH.md](COMPOSIO_PUBLISH.md), which
describes the current flow as it now stands; this file explains *why* it looks that way.

Every claim below was verified live against the real Composio API and the connected test account
(`COMPOSIO_ENTITY_ID` in `backend/.env`), not guessed from docs.

## Bug 1 — every `tools.execute()` call threw `ComposioToolVersionRequiredError`

**Symptom:** any publish attempt (LinkedIn or Twitter) failed immediately.

**Cause:** `@composio/core@0.6.11` resolves an unpinned toolkit version to `"latest"` and refuses to
run it manually unless you pass `dangerouslySkipVersionCheck: true`, pin `toolkitVersions` on the
client, or pin `version` per call. Nothing in `composio.service.js` did any of these, so every
`client.tools.execute(...)` call — `LINKEDIN_GET_MY_INFO`, `LINKEDIN_CREATE_LINKED_IN_POST`,
`TWITTER_CREATE_TWEET` — threw before ever reaching the API.

**Fix:** added `dangerouslySkipVersionCheck: true` to every `tools.execute(...)` call site.
Trade-off noted in `COMPOSIO_PUBLISH.md`: this accepts whatever toolkit version Composio currently
serves rather than pinning one, so a future breaking schema change from Composio surfaces at
runtime instead of at upgrade time.

## Bug 2 — `COMPOSIO_LINKEDIN_AUTHOR_URN` did two unrelated jobs

**Symptom:** not an active failure, but a live landmine — the same env var was read both as the
OAuth auth-config id (`getAuthConfigId`) *and* as a silent static override of the post author URN
inside `fetchLinkedInAuthorUrn`, applied to every real user's `executePost` call, not just tests.

**Fix:** split into `COMPOSIO_LINKEDIN_AUTH_CONFIG_ID` (OAuth only). Removed the static-override
branch entirely — `executePost` now always resolves the author URN dynamically via
`LINKEDIN_GET_MY_INFO`, confirmed live to return `{ data: { id: "<memberId>" } }` (no `urn:`
prefix; the existing key-search fallback already handles this via its `"id"` check).

## Bug 3 — SDK errors were silently swallowed

**Symptom:** every failure surfaced as a generic message ("Could not prepare image for LinkedIn.",
"Could not publish post via Composio.") regardless of the real cause — this is what made bugs 1 and
4 hard to diagnose from the API response alone.

**Cause:** Composio wraps real API failures in `ComposioToolExecutionError`, whose own `.message` is
just `"Error executing the tool X"`. The actual HTTP status and API error body live on `.cause` (a
`@composio/client` `APIError`, whose `.message` is `"<status> <body.message>"`). Every catch block
in `composio.service.js` discarded the caught error and threw a hardcoded string instead.

**Fix:** added `describeSdkError(err, fallback)`, which prefers `err.cause.message`, then
`err.message`, then the fallback. Wired into all catch sites (`wrapSdkError`,
`fetchLinkedInAuthorUrn`, the image-prep branch, the outer `executePost` catch). This is what
surfaced the real error text for bug 4 below — without it we'd still be looking at "Could not
prepare image for LinkedIn." with no way to tell why.

## Bug 4 — the manual image-upload pipeline no longer matches the tool schema

**Symptom (after bug 3's fix surfaced the real message):**
`ENOENT: no such file or directory, open '...\backend\urn:li:digitalmediaAsset:...'`

**Cause, in two parts:**

1. `@composio/core` defaults `autoUploadDownloadFiles` to `true` on Node. `LINKEDIN_CREATE_LINKED_IN_POST`'s
   `images` field is schema-marked `file_uploadable`. With auto-upload on, the SDK intercepted the
   `asset_urn` string the old code got from a separate `LINKEDIN_REGISTER_IMAGE_UPLOAD` call and
   tried to read it as a local file path — hence the `ENOENT`.
2. Disabling `autoUploadDownloadFiles` to stop that interception just traded one error for another:
   Composio's backend rejects `images` unless each entry is an actual `FileUploadable` dict — a
   plain string is rejected with `"Input should be a valid dictionary or instance of
   FileUploadable"`. So the old two-step pipeline (`LINKEDIN_REGISTER_IMAGE_UPLOAD` → PUT the JPEG
   to the returned presigned URL → pass the resulting `asset_urn` string into `images`) cannot work
   against the current tool schema (version `20260707_00`) at all, regardless of the auto-upload
   setting — confirmed live both ways.

**Fix:** pass an in-memory `File` (built from the already-`sharp`-compressed JPEG buffer) directly
as `images`, with `autoUploadDownloadFiles: true` explicitly set in `getClient()`. The SDK uploads
it and builds the `FileUploadable` dict itself. This collapses LinkedIn image posting into a single
`LINKEDIN_CREATE_LINKED_IN_POST` call and removed `LINKEDIN_REGISTER_IMAGE_UPLOAD`,
`extractLinkedInUploadMetadata`, `uploadImageBytesToLinkedIn`, and `createLinkedInPostWithImageUpload`
(~100 lines) from `composio.service.js`. `sharp` compression and the
`COMPOSIO_LINKEDIN_IMAGE_MAX_BYTES`/`MAX_EDGE` env-driven limits are unchanged — they still run
before the `File` is built, so auto-upload never sees an oversized image.

Also fixed in passing: the real `LINKEDIN_CREATE_LINKED_IN_POST` call was previously nested inside
the image-*prep* try/catch, so a genuine publish failure on an image post would have been mislabeled
`LINKEDIN_IMAGE_PREP_FAILED` instead of `COMPOSIO_POST_FAILED`. The publish call now sits outside
that block.

## Files touched

| File | What changed |
|------|--------------|
| `src/services/composio.service.js` | `dangerouslySkipVersionCheck` on all `tools.execute` calls; `describeSdkError` + wired into all catch sites; removed the static author-URN override; removed the register/PUT image pipeline in favor of a `File`-based single call; `autoUploadDownloadFiles: true` set explicitly in `getClient()`; `entityId` → `userId` naming |
| `src/controllers/test.controller.js` | `entityId` → `userId` naming only |
| `src/config/env.js` | `COMPOSIO_LINKEDIN_AUTHOR_URN` → `COMPOSIO_LINKEDIN_AUTH_CONFIG_ID` |
| `.env.example` | same rename; added the previously-undocumented `COMPOSIO_TWITTER_AUTH_CONFIG_ID` |
| `COMPOSIO_PUBLISH.md` | updated to describe the current (fixed) flow and env vars |

`backend/.env` (gitignored, not in this diff) was updated locally to match the renamed var so the
existing dev setup keeps working: `COMPOSIO_LINKEDIN_AUTH_CONFIG_ID=ac_9LM6wWIBHRlb`.

## Things that were already correct (verified, not changed)

- OAuth connection init already used `connectedAccounts.link()`, not the deprecated `.initiate()`.
- `LINKEDIN_REGISTER_IMAGE_UPLOAD`'s input fields (`owner_urn`, `recipe`,
  `supported_upload_mechanism`) matched the real schema — this only mattered before bug 4's fix
  removed the tool from the flow entirely.
- `frontend/` and `design-guide/` `publishPost()` — identical, trivial wrappers around
  `POST /connections/posts/:id/publish`. None of the above changes touch the response shape
  (`{ success, platform, postId? }` / `{ error: { code, message } }`), so no frontend changes were
  needed.
- `ai-service/` has no Composio dependency and always emits raw base64 (never a data URL) for
  `selected_image_base64` across all three image providers (Pollinations, DALL-E, Gemini); the
  backend's `parseDataUrlBase64` already handled both forms.
