# Publish flow (Composio)

Moved and expanded → **[backend/COMPOSIO_PUBLISH.md](backend/COMPOSIO_PUBLISH.md)**

**Summary:** Frontend `publishPost()` → backend `POST /connections/posts/:id/publish` → `executePost()` in `composio.service.js` → Composio SDK. Python `ai-service` generates drafts only; it is not called at publish time.

See also: [ai-service/README.md](ai-service/README.md) → **Publish (Composio)**.
