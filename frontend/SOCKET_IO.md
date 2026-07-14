# Socket.IO Real-time Communication Guide

This document describes the **Socket.IO** real-time communication layer in the SociaAI frontend. Socket.IO enables live updates during post generation and other asynchronous operations, bridging the client and backend via WebSocket with automatic fallback to polling.

---

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [Authentication](#authentication)
4. [Connection Setup](#connection-setup)
5. [Events & Lifecycle](#events--lifecycle)
6. [API Reference](#api-reference)
7. [Usage Examples](#usage-examples)
8. [Error Handling](#error-handling)
9. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

Socket.IO is used in SociaAI to stream **real-time generation updates** from the backend to the frontend. When a user generates post variations:

1. The frontend sends a generation request (HTTP POST) and receives a `requestId`.
2. The frontend opens a Socket.IO connection and joins a room tied to that `requestId`.
3. The backend emits `generation_lifecycle` events as the generation progresses (started, processing, completed, or failed).
4. The frontend receives these events and updates the UI reactively.

### Why Socket.IO?

- **Bidirectional communication** — Client can subscribe to specific generation streams; server can push updates.
- **Automatic fallback** — Uses WebSocket when available, falls back to HTTP long-polling on restrictive networks.
- **Lightweight** — Minimal overhead compared to polling or Server-Sent Events.
- **Authentication-aware** — Token-based auth on connect, with optional bypass mode for development.

### Package

```json
{
  "socket.io-client": "^4.8.3"
}
```

---

## Configuration

Socket.IO is configured via environment variables read at runtime. All environment variables are prefixed with `VITE_` and read from `import.meta.env` in Vite.

### Environment Variables

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `VITE_SOCKET_URL` | string | `${VITE_API_BASE_URL}` or `http://localhost:3001` | WebSocket server URL (no trailing slash) |
| `VITE_API_BASE_URL` | string | `http://localhost:3001` | HTTP API base; used as fallback for Socket.IO URL |
| `VITE_SOCKET_BYPASS` | string | `"false"` | Enable bypass mode (for dev; disables token auth) |
| `VITE_SOCKET_BYPASS_SECRET` | string | _(optional)_ | Shared secret when bypass is enabled (dev mode) |

### Example `.env` Files

**Development (with token auth)**

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
# VITE_SOCKET_BYPASS not set or false
```

**Development (bypass mode, no auth)**

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_SOCKET_BYPASS=true
VITE_SOCKET_BYPASS_SECRET=shared-dev-secret
```

**Production**

```env
VITE_API_BASE_URL=https://api.example.com
VITE_SOCKET_URL=https://api.example.com
VITE_SOCKET_BYPASS=false
```

---

## Authentication

Socket.IO authentication is handled during the connection handshake. The frontend builds an **auth payload** and passes it to the Socket.IO client constructor.

### Auth Payload Structure

```typescript
type SocketAuthPayload = {
  token?: string;           // JWT token from localStorage
  bypass?: boolean;         // Bypass mode flag (dev only)
  bypassSecret?: string;    // Bypass secret (dev only)
};
```

### How Authentication Works

1. **Token Auth (Production)**
   - Frontend reads `authToken` from `localStorage.authToken`.
   - If present and non-empty, includes it in the auth payload.
   - Backend validates the JWT on the Socket.IO server.

2. **Bypass Mode (Development)**
   - When `VITE_SOCKET_BYPASS=true`, frontend includes `bypass: true` and `bypassSecret` in the auth payload.
   - Backend allows connection without token validation.
   - Useful for local development without a valid JWT.

3. **No Auth / Unauthenticated**
   - If no token is available and bypass is disabled, the auth payload is empty.
   - Backend may reject the connection or allow limited access.

### Example Auth Payload Generation

See [`src/api/socket.ts`](src/api/socket.ts):

```typescript
export function buildSocketAuthPayload(): SocketAuthPayload {
  let token = "";
  try {
    token = localStorage.getItem("authToken")?.trim() ?? "";
  } catch {
    token = "";
  }
  
  const auth = token ? { token } : {};
  const bypassRaw = readRaw("VITE_SOCKET_BYPASS").toLowerCase();
  const bypass = bypassRaw === "true" || bypassRaw === "1" || bypassRaw === "yes";
  
  if (!bypass) return auth;
  
  const bypassSecret = readRaw("VITE_SOCKET_BYPASS_SECRET");
  return {
    ...auth,
    bypass: true,
    ...(bypassSecret ? { bypassSecret } : {}),
  };
}
```

---

## Connection Setup

### Socket.IO Client Initialization

See [`src/hooks/useGenerationSocket.ts`](../src/hooks/useGenerationSocket.ts).

#### Basic Connection

```typescript
import { io } from "socket.io-client";
import { buildSocketAuthPayload, getSocketUrl } from "../api/socket";

const socket = io(getSocketUrl(), {
  transports: ["websocket", "polling"],
  auth: buildSocketAuthPayload(),
});
```

#### Parameters

| Parameter | Value | Meaning |
|-----------|-------|---------|
| **URL** | `getSocketUrl()` | Socket.IO server URL (e.g., `http://localhost:3001`) |
| **transports** | `["websocket", "polling"]` | Prefer WebSocket; fall back to HTTP polling if WebSocket fails |
| **auth** | `buildSocketAuthPayload()` | Auth credentials (token or bypass) |

#### Socket.IO Events (Built-in)

- **`connect`** — Connection established; emit `join_generation` to subscribe to updates.
- **`connect_error`** — Connection failed; emit error callback.
- **`disconnect`** — Connection closed.

---

## Events & Lifecycle

### Generation Lifecycle Events

The frontend listens for **`generation_lifecycle`** events from the backend. Each event represents a state change in the post-generation pipeline.

#### Event Type

```typescript
export type GenerationLifecycleEvent = 
  | GenerationLifecycleSucceeded 
  | GenerationLifecycleFailed;

export type GenerationLifecycleSucceeded = {
  requestId: string;
  status: "succeeded";
  finishedAt: string;                          // ISO 8601 timestamp
  result: {
    postId: string | null;
    variations: PostVariation[];                // Array of generated variations
    model?: string | null;
    pipeline?: unknown;
  };
  meta?: {
    userId?: string | null;
    topic?: string;
    tones?: string[];
    sourceRequestId?: string;
  };
};

export type GenerationLifecycleFailed = {
  requestId: string;
  status: "failed";
  finishedAt: string;                          // ISO 8601 timestamp
  error: {
    code: string;
    message: string;
    stage?: string;                            // e.g., "generation", "inference"
  };
  result?: Record<string, unknown>;
  meta?: {
    userId?: string | null;
    topic?: string;
    tones?: string[];
    sourceRequestId?: string;
  };
};
```

#### Example Payload (Success)

```json
{
  "requestId": "req_abc123",
  "status": "succeeded",
  "finishedAt": "2026-07-14T12:34:56Z",
  "result": {
    "postId": "post_xyz789",
    "variations": [
      {
        "index": 0,
        "text": "Excited to announce...",
        "model": "claude-3-sonnet"
      }
    ],
    "model": "claude-3-sonnet",
    "pipeline": {...}
  },
  "meta": {
    "userId": "user_123",
    "topic": "AI breakthroughs",
    "tones": ["professional", "informative"]
  }
}
```

#### Example Payload (Failure)

```json
{
  "requestId": "req_abc123",
  "status": "failed",
  "finishedAt": "2026-07-14T12:34:57Z",
  "error": {
    "code": "GENERATION_TIMEOUT",
    "message": "Generation exceeded 60 seconds",
    "stage": "inference"
  },
  "meta": {
    "userId": "user_123",
    "topic": "AI breakthroughs"
  }
}
```

### Socket Events Flow

```
┌─────────────────────────────────────────────────────────┐
│ Frontend                                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. HTTP POST /ai/generate → backend                   │
│     Response: { requestId: "req_abc123" }              │
│                                                         │
│  2. socket.io connect                                  │
│     Listen: "connect" event                            │
│                                                         │
│  3. socket.emit("join_generation", { requestId })     │
│     Ack: { ok: true }                                  │
│                                                         │
│  4. Listen: "generation_lifecycle"                     │
│     Events arrive as generation progresses             │
│                                                         │
│  5. On completion: socket.disconnect()                 │
│                                                         │
└─────────────────────────────────────────────────────────┘

                        ↕ Socket.IO

┌─────────────────────────────────────────────────────────┐
│ Backend (Node.js)                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Receive HTTP request, store requestId              │
│                                                         │
│  2. Client joins room "generation:req_abc123"          │
│                                                         │
│  3. Emit "generation_lifecycle" events                 │
│     - Started: { status: "started" }                   │
│     - Progress: { status: "processing" }               │
│     - Success: { status: "succeeded", result: {...} }  │
│     - Failure: { status: "failed", error: {...} }      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## API Reference

### Socket.IO Helper Functions

#### `getSocketUrl(): string`

**File:** `src/api/socket.ts`

Determines the Socket.IO server URL from environment variables.

**Logic:**

1. If `VITE_SOCKET_URL` is set, use it.
2. Otherwise, fall back to `VITE_API_BASE_URL` (default: `http://localhost:3001`).
3. Remove trailing slashes.

**Example:**

```typescript
const url = getSocketUrl();
// Output: "http://localhost:3001"
```

---

#### `buildSocketAuthPayload(): SocketAuthPayload`

**File:** `src/api/socket.ts`

Builds the auth payload for Socket.IO connection handshake.

**Logic:**

1. Read `authToken` from `localStorage.authToken`.
2. If `VITE_SOCKET_BYPASS=true`, include bypass credentials.
3. Return auth object for Socket.IO client.

**Example:**

```typescript
const auth = buildSocketAuthPayload();
// Token auth: { token: "eyJhbGc..." }
// Bypass auth: { bypass: true, bypassSecret: "shared-dev-secret" }
// No auth: {}
```

---

### React Hook: `useGenerationSocket()`

**File:** `src/hooks/useGenerationSocket.ts`

Custom React hook that manages Socket.IO connection lifecycle for a single generation request.

#### Signature

```typescript
export function useGenerationSocket(props: {
  requestId: string | null;
  onEvent: (event: GenerationLifecycleEvent) => void;
  onSocketError: (message: string) => void;
}): void
```

#### Props

| Prop | Type | Purpose |
|------|------|---------|
| `requestId` | `string \| null` | Request ID from HTTP POST response. If `null`, no connection is attempted. |
| `onEvent` | `(event: GenerationLifecycleEvent) => void` | Callback fired when a `generation_lifecycle` event is received. |
| `onSocketError` | `(message: string) => void` | Callback fired on connection or subscription errors. |

#### Behavior

1. **On mount or when `requestId` changes:**
   - If `requestId` is `null`, returns early (no connection).
   - Creates a Socket.IO client with auth.
   - Listens for `connect` event.

2. **On `connect`:**
   - Emits `join_generation` with `{ requestId }`.
   - Backend acknowledges; if `ack.ok !== true`, calls `onSocketError`.

3. **On `generation_lifecycle`:**
   - Filters events by `requestId` (ignores mismatches).
   - Calls `onEvent(payload)`.

4. **On `connect_error`:**
   - Calls `onSocketError` with error message.

5. **On unmount or when `requestId` becomes `null`:**
   - Disconnects socket.

#### Example Usage

```typescript
import { useGenerationSocket } from "../hooks/useGenerationSocket";

function MyComponent() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [event, setEvent] = useState<GenerationLifecycleEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useGenerationSocket({
    requestId,
    onEvent: (evt) => {
      setEvent(evt);
      if (evt.status === "succeeded") {
        console.log("Generation complete:", evt.result);
      }
    },
    onSocketError: (msg) => {
      setError(msg);
    },
  });

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {event && <div className="status">{event.status}</div>}
    </div>
  );
}
```

---

## Usage Examples

### Example 1: Basic Generation with Real-time Updates

**File:** `src/pages/GeneratorPage.tsx`

```typescript
import { useGenerationSocket } from "../hooks/useGenerationSocket";
import { generatePost } from "../api/generate";

export function GeneratorPage() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [variations, setVariations] = useState<PostVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time updates
  useGenerationSocket({
    requestId,
    onEvent: (event) => {
      if (event.status === "succeeded") {
        setVariations(event.result.variations);
        setLoading(false);
      } else if (event.status === "failed") {
        setError(event.error.message);
        setLoading(false);
      }
    },
    onSocketError: (msg) => {
      setError(`Socket error: ${msg}`);
      setLoading(false);
    },
  });

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await generatePost({
        topic: "AI trends",
        tones: ["informative"],
      });
      setRequestId(response.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate"}
      </button>
      {error && <div className="error">{error}</div>}
      {variations.map((v, i) => (
        <div key={i}>{v.text}</div>
      ))}
    </div>
  );
}
```

### Example 2: Error Recovery

If the connection fails, manually retry by clearing `requestId` and retrying:

```typescript
const handleRetry = async () => {
  setRequestId(null); // Disconnect
  await new Promise((r) => setTimeout(r, 1000)); // Wait 1s
  const response = await generatePost({ topic, tones });
  setRequestId(response.requestId); // Reconnect
};
```

### Example 3: Multiple Concurrent Generations

Each call to `useGenerationSocket` manages a separate connection:

```typescript
function MultiGenerationPage() {
  const [generations, setGenerations] = useState<
    { requestId: string; event?: GenerationLifecycleEvent; error?: string }[]
  >([]);

  generations.forEach((gen, idx) => {
    useGenerationSocket({
      requestId: gen.requestId,
      onEvent: (event) => {
        setGenerations((prev) =>
          prev.map((g, i) =>
            i === idx ? { ...g, event, error: undefined } : g
          )
        );
      },
      onSocketError: (msg) => {
        setGenerations((prev) =>
          prev.map((g, i) =>
            i === idx ? { ...g, error: msg, event: undefined } : g
          )
        );
      },
    });
  });

  return (
    <div>
      {generations.map((gen, i) => (
        <div key={i}>
          {gen.error && <div className="error">{gen.error}</div>}
          {gen.event?.status === "succeeded" && (
            <div>{gen.event.result.variations.length} variations</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Error Handling

### Connection Errors

**Scenario:** Backend is offline or unreachable.

**Handling:**

```typescript
useGenerationSocket({
  requestId,
  onSocketError: (message) => {
    console.error("Connection failed:", message);
    // Show user a retry button
  },
});
```

**Common Messages:**

- `"Could not subscribe to generation updates."` — `join_generation` emit failed; backend rejected the subscription.
- `"Realtime connection failed."` — WebSocket/polling transport failed; network issue or server down.

### Timeout Errors

**Scenario:** Generation takes longer than expected.

**Handling:**

If no event is received after a reasonable timeout (e.g., 5 minutes), consider it stalled:

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (requestId && !event) {
      setError("Generation timeout: no response from server");
    }
  }, 5 * 60 * 1000); // 5 minutes

  return () => clearTimeout(timer);
}, [requestId, event]);
```

### Network Interruptions

**Scenario:** User loses connection mid-generation.

**Handling:**

Socket.IO automatically attempts to reconnect (default: exponential backoff). On reconnection, the socket re-emits `join_generation` and resumes listening. If the backend has already completed the generation, the client receives the final event on reconnect.

---

## Troubleshooting

### Connection Refused

**Symptom:** `Error: connect ECONNREFUSED 127.0.0.1:3001`

**Causes:**

1. Backend server is not running.
2. Wrong `VITE_SOCKET_URL` (check `.env`).
3. Backend firewall blocking port 3001.

**Solution:**

```bash
# Check backend is running
cd backend && npm run dev

# Verify VITE_SOCKET_URL points to backend
cat frontend/.env | grep VITE_SOCKET_URL
# Expected: VITE_SOCKET_URL=http://localhost:3001
```

---

### Events Not Arriving

**Symptom:** `join_generation` succeeds, but no `generation_lifecycle` events are received.

**Causes:**

1. Backend crashed or didn't start generation.
2. Backend and frontend `requestId` mismatch.
3. Backend is emitting to the wrong room.

**Solution:**

1. Check backend logs:
   ```bash
   cd backend && npm run dev
   # Look for: "generation started: req_abc123"
   ```

2. Verify `requestId` on frontend:
   ```typescript
   console.log("Subscribing to:", requestId);
   ```

3. Check backend is emitting the correct room:
   ```javascript
   // Backend should emit to room, not broadcast
   io.to(`generation:${requestId}`).emit("generation_lifecycle", event);
   ```

---

### "Could not subscribe to generation updates"

**Symptom:** `onSocketError` called with this message immediately after connect.

**Causes:**

1. Backend rejected the `join_generation` emit (likely auth failure).
2. Backend returned `ack.ok = false`.

**Solution:**

Check backend auth middleware:

```javascript
// Backend (Node.js) should accept the join
socket.on("join_generation", (data, callback) => {
  if (data?.requestId) {
    socket.join(`generation:${data.requestId}`);
    callback({ ok: true }); // Success
  } else {
    callback({ ok: false, message: "Missing requestId" });
  }
});
```

---

### Connection Works Locally, Fails in Production

**Symptom:** Socket.IO works on `localhost:3001`, fails on `https://api.example.com`.

**Causes:**

1. Production CORS misconfigured.
2. Proxy not forwarding WebSocket upgrades.
3. Wrong `VITE_SOCKET_URL` in production build.

**Solution:**

1. Check production `.env`:
   ```env
   VITE_SOCKET_URL=https://api.example.com
   # NOT http://localhost:3001
   ```

2. Verify backend CORS allows the frontend origin:
   ```javascript
   // Backend
   const io = require("socket.io")(server, {
     cors: {
       origin: process.env.FRONTEND_ORIGIN || "https://app.example.com",
       methods: ["GET", "POST"],
     },
   });
   ```

3. Check proxy forwards WebSocket:
   ```nginx
   # Nginx example
   location / {
     proxy_pass http://backend:3001;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
   }
   ```

---

### High Memory Usage / Connection Leaks

**Symptom:** Frontend memory grows over time; multiple sockets open per request.

**Causes:**

1. `useGenerationSocket` hook not cleaning up on unmount.
2. Multiple `requestId` changes without disconnecting old sockets.

**Solution:**

Ensure the hook cleanup is working:

```typescript
// Correct: cleanup on unmount
useEffect(() => {
  // ... setup socket
  return () => {
    socket.disconnect(); // ✓ Called on unmount
  };
}, [requestId]);
```

---

## Security Considerations

### Token Storage

- `authToken` is stored in `localStorage`, which is **vulnerable to XSS**.
- Do **not** store sensitive data (passwords, refresh tokens) in `localStorage`.
- In production, consider **`httpOnly` cookies** for tokens.

### Bypass Mode

- **Never** enable `VITE_SOCKET_BYPASS=true` in production.
- Bypass mode disables authentication; any client can connect.
- Use only for **local development**.

### CORS & CSRF

- Socket.IO respects browser CORS rules on the initial HTTP upgrade.
- Backend should validate `origin` header and reject cross-domain connections in production.
- Use **same-site origin** in production; avoid `*` CORS policy.

---

## Performance Tips

1. **Reuse Connections** — Don't create a new socket per request. Reuse sockets when possible.
2. **Batch Events** — If the backend emits many small events, batch them into fewer, larger events.
3. **Cleanup** — Always disconnect sockets on component unmount to free resources.
4. **Transport Priority** — Keep `transports: ["websocket", "polling"]` (WebSocket is much faster).

---

## Related Files

| File | Purpose |
|------|---------|
| [`src/api/socket.ts`](../src/api/socket.ts) | Socket.IO URL and auth helpers |
| [`src/hooks/useGenerationSocket.ts`](../src/hooks/useGenerationSocket.ts) | React hook for generation lifecycle |
| [`src/pages/GeneratorPage.tsx`](../src/pages/GeneratorPage.tsx) | Example usage of Socket.IO |
| [`src/types/generate.ts`](../src/types/generate.ts) | TypeScript types for generation events |
| [`package.json`](../package.json) | Dependencies (socket.io-client v4.8.3) |

---

## Further Reading

- **Socket.IO Client Docs:** https://socket.io/docs/v4/client-api/
- **Socket.IO Server Docs:** https://socket.io/docs/v4/server-api/
- **Vite Environment Variables:** https://vitejs.dev/guide/env-and-modes.html
- **React Hooks Best Practices:** https://react.dev/reference/react/useEffect
