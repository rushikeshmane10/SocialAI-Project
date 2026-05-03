# Publish Flow Map (Frontend -> Backend -> Composio)

This README answers:

1. Where `executePost` is defined
2. Where `composio.service.js` lives
3. Where the publish route handler is
4. What is called from frontend, what is passed, and which backend service posts via Composio

## Quick Answers

- **Where is `executePost` defined?**
  - `backend/src/services/composio.service.js`
  - There is an exported function plus an append-only override at the bottom; the active call path uses the override assignment.

- **Where is `composio.service.js`?**
  - `backend/src/services/composio.service.js`

- **Where is the publish route handler?**
  - Route: `backend/src/routes/connections.routes.js`
  - Handler function: `publishPost` in `backend/src/controllers/connections.controller.js`
  - Route path: `POST /connections/posts/:id/publish`

## Frontend Structure

### UI trigger

- File: `frontend/src/pages/GeneratorPage.tsx`
- Function: `onPost()`
- Call:
  - `await publishPost(postId, "linkedin")`

### Frontend API layer

- File: `frontend/src/api/client.ts`
- Function: `publishPost(postId, platform)`
- Request:
  - Method: `POST`
  - URL: `/connections/posts/${encodeURIComponent(postId)}/publish`
  - Body: `{ platform: "linkedin" | "twitter" }`
  - Headers:
    - `content-type: application/json`
    - `X-User-Id: <uuid from localStorage.userId>`

## Backend Structure

### Route registration

- File: `backend/src/routes/connections.routes.js`
- Route:
  - `POST /connections/posts/:id/publish`
  - middleware: `requireUserId`
  - handler: `publishPost`

### Publish handler

- File: `backend/src/controllers/connections.controller.js`
- Function: `publishPost(req, res)` (append-only override is active)
- It validates:
  - `body.platform` in `["linkedin", "twitter"]`
  - post exists and belongs to current user
  - post is selected and has `selected_text`
  - user is connected on selected platform
- It then calls:
  - `executePost(composioEntityId, platform, post.selected_text)`

### Composio posting service

- File: `backend/src/services/composio.service.js`
- Service function: `executePost(userId, platform, text)`
- Composio usage:
  - Resolves entity via Composio SDK
  - For LinkedIn, tries actions:
    - `LINKEDIN_CREATE_POST`
    - `LINKEDIN_CREATE_LINKED_IN_POST`
  - For Twitter:
    - `TWITTER_CREATE_TWEET`

## Data Passed End-to-End

- **Path param**
  - `id` -> post id (`:id`)
- **Body**
  - `platform` -> `"linkedin"` or `"twitter"`
- **Header**
  - `X-User-Id` -> required by backend auth middleware
- **Final Composio payload source**
  - Text sent to Composio is `post.selected_text` from DB

## Response Shape

Success (`200`):

```json
{
  "success": true,
  "platform": "linkedin",
  "postId": "optional-external-id"
}
```

Error:

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message"
  }
}
```
