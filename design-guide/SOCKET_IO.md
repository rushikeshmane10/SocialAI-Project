# Socket.IO Real-time Communication Guide — Design Guide

This document describes the **Socket.IO** real-time communication layer integrated into the **design-guide** project. This is a **TanStack Start** application with React 19 and TypeScript that uses Socket.IO to stream real-time updates from the backend during post generation.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration](#configuration)
4. [Authentication](#authentication)
5. [Connection Setup](#connection-setup)
6. [Events & Lifecycle](#events--lifecycle)
7. [API Reference](#api-reference)
8. [Usage Examples](#usage-examples)
9. [TanStack Start Integration](#tanstack-start-integration)
10. [Error Handling](#error-handling)
11. [Troubleshooting](#troubleshooting)

---

## Overview

### Purpose

Socket.IO bridges the **design-guide** frontend and the **backend** to deliver real-time generation updates. When a user generates post variations:

1. The frontend sends a generation request (HTTP POST) and receives a `requestId`.
2. A Socket.IO connection is established and the client joins a room tied to that `requestId`.
3. The backend emits `generation_lifecycle` events as generation progresses.
4. The frontend reactively updates the UI with these real-time events.

### Stack

| Component | Version |
|-----------|---------|
| **Framework** | TanStack Start (built on Vite 7.3) |
| **React** | 19.2 |
| **TypeScript** | 5.8 |
| **Socket.IO Client** | 4.8.3 |
| **State Management** | TanStack Query 5.83 |
| **UI Framework** | Radix UI + Tailwind CSS 4.2 |

### Why Socket.IO?

- **Real-time bidirectional communication** — Events push instantly from server to client.
- **Automatic fallback** — WebSocket + HTTP long-polling ensures connectivity across restrictive networks.
- **Room-based subscriptions** — Client subscribes to a specific `requestId` room; receives only relevant updates.
- **Authentication-aware** — Token-based auth on connect, with dev bypass mode.

---

## Architecture

### Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ Design Guide (TanStack Start)                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  useGenerationSocket Hook                                    │
│  ├─ Reads requestId from HTTP response                      │
│  ├─ Creates Socket.IO client                                │
│  ├─ Emits join_generation with requestId                    │
│  └─ Listens for generation_lifecycle events                 │
│                                                              │
│  React Component                                             │
│  ├─ Calls API: generatePost()                               │
│  ├─ Receives: { requestId }                                 │
│  ├─ Passes to: useGenerationSocket()                        │
│  └─ Updates UI on onEvent callback                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘

                      Socket.IO (WebSocket + Polling)

┌──────────────────────────────────────────────────────────────┐
│ Backend (Node.js + Express + Socket.IO)                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  POST /ai/generate                                           │
│  ├─ Validate request                                         │
│  ├─ Generate requestId                                       │
│  └─ Return: { requestId, status: "started" }               │
│                                                              │
│  Socket.IO Server                                            │
│  ├─ Client emits: join_generation                           │
│  ├─ Server joins room: generation:${requestId}             │
│  ├─ Server emits: generation_lifecycle                      │
│  │  ├─ Status: started                                      │
│  │  ├─ Status: processing                                   │
│  │  ├─ Status: succeeded (with variations)                  │
│  │  └─ Status: failed (with error)                          │
│  └─ Client receives events via room broadcast              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Configuration

Socket.IO is configured via **Vite environment variables**, prefixed with `VITE_`.

### Environment Variables

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `VITE_API_BASE_URL` | string | `http://localhost:3001` | HTTP API base (also used for Socket.IO fallback) |
| `VITE_SOCKET_URL` | string | Uses `VITE_API_BASE_URL` | Explicit Socket.IO server URL (no trailing slash) |
| `VITE_SOCKET_BYPASS` | string | `"false"` | Enable bypass mode (dev only; disables token auth) |
| `VITE_SOCKET_BYPASS_SECRET` | string | _(optional)_ | Shared secret for bypass mode |

### `.env` Files

**Development (.env.local)**

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_SOCKET_BYPASS=true
VITE_SOCKET_BYPASS_SECRET=shared-dev-secret
```

**Production (.env.production)**

```env
VITE_API_BASE_URL=https://api.example.com
VITE_SOCKET_URL=https://api.example.com
VITE_SOCKET_BYPASS=false
```

### In `.env.example` (Template)

```env
# Backend API (Node). Default if unset: http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001

# Socket.IO server URL (usually same origin as API). If unset, uses VITE_API_BASE_URL.
# VITE_SOCKET_URL=http://localhost:3001

# Dev-only socket auth bypass (must match backend if enabled)
# VITE_SOCKET_BYPASS=false
# VITE_SOCKET_BYPASS_SECRET=
```

---

## Authentication

Socket.IO authentication occurs during the WebSocket handshake. The frontend builds an **auth payload** from environment variables and local storage, then passes it to the Socket.IO client constructor.

### Auth Payload Structure

```typescript
type SocketAuthPayload = {
  token?: string;           // JWT token from localStorage
  bypass?: boolean;         // Bypass mode flag (dev only)
  bypassSecret?: string;    // Bypass secret (dev only)
};
```

### Authentication Flow

#### 1. **Token-Based Auth (Production)**

```typescript
// Read token from localStorage
const token = localStorage.getItem("authToken");

// Socket.IO includes token in handshake
const socket = io(url, {
  auth: { token }
});

// Backend validates JWT
socket.on("connect", () => {
  console.log("Authenticated as:", userId);
});
```

#### 2. **Bypass Mode (Development)**

```typescript
// .env.local
VITE_SOCKET_BYPASS=true
VITE_SOCKET_BYPASS_SECRET=shared-dev-secret

// Socket.IO includes bypass credentials
const socket = io(url, {
  auth: {
    bypass: true,
    bypassSecret: "shared-dev-secret"
  }
});

// Backend skips JWT validation, allows connection
```

#### 3. **No Auth (Unauthenticated)**

```typescript
// No token + bypass disabled
const socket = io(url, {
  auth: {}  // Empty or omitted
});

// Backend may reject or allow limited access
```

### Implementation

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

See [`src/hooks/useGenerationSocket.ts`](src/hooks/useGenerationSocket.ts).

```typescript
import { io } from "socket.io-client";
import { buildSocketAuthPayload, getSocketUrl } from "@/api/socket";

const socket = io(getSocketUrl(), {
  transports: ["websocket", "polling"],
  auth: buildSocketAuthPayload(),
});
```

#### Configuration Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **URL** | `getSocketUrl()` | Server address (e.g., `http://localhost:3001`) |
| **transports** | `["websocket", "polling"]` | Try WebSocket first; fall back to HTTP polling |
| **auth** | `buildSocketAuthPayload()` | Token or bypass credentials |

#### Built-in Socket Events

- **`connect`** — Connection established; safe to emit/subscribe.
- **`connect_error`** — Connection failed; emit error to handler.
- **`disconnect`** — Connection closed (intentional or network failure).
- **`reconnect`** — Reconnection successful (auto-retry after network interruption).

---

## Events & Lifecycle

### Generation Lifecycle Events

The backend emits **`generation_lifecycle`** events as post generation progresses. Each event represents a state transition in the pipeline.

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

#### Example Payloads

**Success:**

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
        "text": "Excited to announce the future of AI...",
        "model": "claude-3-sonnet"
      },
      {
        "index": 1,
        "text": "Breaking: New AI paradigm emerges...",
        "model": "claude-3-sonnet"
      }
    ],
    "model": "claude-3-sonnet"
  },
  "meta": {
    "userId": "user_123",
    "topic": "AI breakthroughs",
    "tones": ["professional"]
  }
}
```

**Failure:**

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

---

## API Reference

### Socket Helper Functions

#### `getSocketUrl(): string`

**File:** `src/api/socket.ts`

Resolves the Socket.IO server URL from environment variables.

**Logic:**

1. If `VITE_SOCKET_URL` is set, use it (highest priority).
2. Otherwise, use `VITE_API_BASE_URL` (default: `http://localhost:3001`).
3. Strip trailing slashes.

**Example:**

```typescript
const url = getSocketUrl();
// Returns: "http://localhost:3001" or "https://api.example.com"
```

---

#### `buildSocketAuthPayload(): SocketAuthPayload`

**File:** `src/api/socket.ts`

Constructs authentication credentials for the Socket.IO handshake.

**Logic:**

1. Attempt to read `authToken` from `localStorage`.
2. If `VITE_SOCKET_BYPASS=true`, include bypass mode flag and secret.
3. Return auth object for Socket.IO client.

**Example:**

```typescript
const auth = buildSocketAuthPayload();

// Token auth (production):
// { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }

// Bypass auth (development):
// { bypass: true, bypassSecret: "shared-dev-secret" }

// No auth:
// {}
```

---

### React Hook: `useGenerationSocket()`

**File:** `src/hooks/useGenerationSocket.ts`

Custom React hook managing Socket.IO connection lifecycle for a single generation request.

#### Signature

```typescript
export function useGenerationSocket(props: {
  requestId: string | null;
  onEvent: (event: GenerationLifecycleEvent) => void;
  onSocketError: (message: string) => void;
}): void
```

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `requestId` | `string \| null` | Request ID from POST response. Pass `null` to skip connection. |
| `onEvent` | `(event: GenerationLifecycleEvent) => void` | Callback fired when a lifecycle event arrives. |
| `onSocketError` | `(message: string) => void` | Callback fired on connection or subscription errors. |

#### Lifecycle

1. **On mount or when `requestId` changes:**
   - If `requestId` is `null`, returns early (no connection attempted).
   - Creates Socket.IO client with authentication.
   - Registers event listeners.

2. **On `connect` event:**
   - Emits `join_generation` with `{ requestId }`.
   - Backend acknowledges; on failure, calls `onSocketError`.

3. **On `generation_lifecycle` event:**
   - Validates `requestId` matches (ignores mismatches).
   - Calls `onEvent(payload)`.

4. **On `connect_error` event:**
   - Calls `onSocketError(error.message)`.

5. **On unmount or when `requestId` becomes `null`:**
   - Disconnects socket and cleans up listeners.

---

## Usage Examples

### Example 1: Basic Generation Component

**Using TanStack Router loaders + useGenerationSocket:**

```typescript
// src/routes/generate.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useGenerationSocket } from '@/hooks/useGenerationSocket'
import { generatePost } from '@/api/generate'
import type { GenerationLifecycleEvent } from '@/types/generate'

export const Route = createFileRoute('/generate')({
  component: GenerateComponent,
})

function GenerateComponent() {
  const [requestId, setRequestId] = React.useState<string | null>(null)
  const [variations, setVariations] = React.useState<PostVariation[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  // Subscribe to real-time generation updates
  useGenerationSocket({
    requestId,
    onEvent: (event: GenerationLifecycleEvent) => {
      if (event.status === 'succeeded') {
        setVariations(event.result.variations)
        setError(null)
        setIsLoading(false)
      } else if (event.status === 'failed') {
        setError(event.error.message)
        setIsLoading(false)
      }
    },
    onSocketError: (message) => {
      setError(`Socket error: ${message}`)
      setIsLoading(false)
    },
  })

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await generatePost({
        topic: 'AI trends',
        tones: ['informative', 'professional'],
      })
      setRequestId(response.requestId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <button 
        onClick={handleGenerate} 
        disabled={isLoading}
        className="px-6 py-2 bg-blue-500 text-white rounded"
      >
        {isLoading ? 'Generating...' : 'Generate'}
      </button>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {variations.map((variation, idx) => (
          <div key={idx} className="p-4 border rounded">
            <p className="text-sm text-gray-600">Variation {idx + 1}</p>
            <p className="mt-2">{variation.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Example 2: Retry Logic

Retry a failed generation with exponential backoff:

```typescript
const handleRetry = async () => {
  setRequestId(null)  // Disconnect old socket
  await new Promise((resolve) => setTimeout(resolve, 1000))  // Wait 1s
  
  try {
    const response = await generatePost({ topic, tones })
    setRequestId(response.requestId)
  } catch (err) {
    setError('Retry failed')
  }
}
```

### Example 3: Multiple Concurrent Generations

Using an array to manage multiple generation requests:

```typescript
type Generation = {
  id: string
  requestId: string | null
  event?: GenerationLifecycleEvent
  error?: string
}

function MultiGeneratorPage() {
  const [generations, setGenerations] = React.useState<Generation[]>([])

  // Each generation item renders its own useGenerationSocket
  return (
    <div className="space-y-4">
      {generations.map((gen) => (
        <GenerationItem 
          key={gen.id} 
          generation={gen}
          onUpdate={(updated) => {
            setGenerations((prev) =>
              prev.map((g) => g.id === gen.id ? updated : g)
            )
          }}
        />
      ))}
      
      <button onClick={() => setGenerations([...generations, { 
        id: Date.now().toString(), 
        requestId: null 
      }])}>
        + New Generation
      </button>
    </div>
  )
}

function GenerationItem({ generation, onUpdate }: Props) {
  useGenerationSocket({
    requestId: generation.requestId,
    onEvent: (event) => {
      onUpdate({ ...generation, event, error: undefined })
    },
    onSocketError: (message) => {
      onUpdate({ ...generation, error: message, event: undefined })
    },
  })

  return (
    <div className="p-4 border rounded">
      {generation.error && <div className="text-red-600">{generation.error}</div>}
      {generation.event?.status === 'succeeded' && (
        <div>{generation.event.result.variations.length} variations</div>
      )}
    </div>
  )
}
```

---

## TanStack Start Integration

### Why TanStack Start?

- **Built on Vite 7** — Fast HMR, modern tooling.
- **Server-client hybrid** — Optional backend integration (e.g., for rendering).
- **File-based routing** — Auto-generates routes from `src/routes/`.
- **API routes** — Optional server-side route handlers.
- **RPC** — Isomorphic data fetching.

### Using Socket.IO with TanStack Router

Socket.IO works seamlessly with **TanStack Router** since it's a client-side WebSocket library. No server-side integration required.

#### File-Based Route Example

```
src/routes/
├── generate.tsx              // Main generation page
├── generate.socket.tsx       // Socket-enabled sub-route (if needed)
└── generate/
    └── $id.tsx              // Generation detail page
```

#### Route Component with Socket

```typescript
// src/routes/generate.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useGenerationSocket } from '@/hooks/useGenerationSocket'

export const Route = createFileRoute('/generate')({
  component: GenerateRoute,
})

function GenerateRoute() {
  const [requestId, setRequestId] = React.useState<string | null>(null)
  
  // useGenerationSocket automatically manages WebSocket lifecycle
  useGenerationSocket({
    requestId,
    onEvent: (event) => {
      console.log('Generation event:', event)
    },
    onSocketError: (message) => {
      console.error('Socket error:', message)
    },
  })

  return (
    <div>
      {/* Component JSX */}
    </div>
  )
}
```

---

## Error Handling

### Connection Errors

**Scenario:** Backend is offline or network is unreachable.

**Solution:**

```typescript
useGenerationSocket({
  requestId,
  onSocketError: (message) => {
    if (message.includes("Connection refused")) {
      setError("Backend is offline. Please try again.")
    } else if (message.includes("not subscribe")) {
      setError("Failed to subscribe to updates. Refresh and retry.")
    } else {
      setError(`Connection error: ${message}`)
    }
  },
})
```

### Timeout Errors

**Scenario:** Generation takes longer than expected.

**Solution:**

```typescript
useEffect(() => {
  const timeout = setTimeout(() => {
    if (requestId && !event) {
      setError("Generation timeout (5+ minutes). Please try again.")
    }
  }, 5 * 60 * 1000)

  return () => clearTimeout(timeout)
}, [requestId, event])
```

### Network Interruptions

**Scenario:** User loses internet mid-generation.

**Behavior:** Socket.IO automatically attempts to reconnect with exponential backoff. On reconnection, the socket re-subscribes and resumes listening. If the backend has completed the generation, the final event is emitted on reconnect.

---

## Troubleshooting

### "Could not subscribe to generation updates"

**Cause:** `join_generation` emit failed; likely auth rejection.

**Debug:**

```typescript
// Add logging to hook
socket.on("connect", () => {
  console.log("Socket connected, userId:", socket.id)
  socket.emit("join_generation", { requestId }, (ack) => {
    console.log("Ack received:", ack)
    if (!ack?.ok) {
      console.error("Subscription failed:", ack?.message)
    }
  })
})
```

**Solution:**

1. Verify JWT is valid: `localStorage.getItem("authToken")`
2. Check backend auth middleware accepts the token
3. If using bypass mode, ensure `VITE_SOCKET_BYPASS=true` and secret matches backend

### Events Not Arriving

**Cause:** `requestId` mismatch or backend not emitting.

**Debug:**

```typescript
socket.on("generation_lifecycle", (payload) => {
  console.log("Received lifecycle event:", payload)
  console.log("Expected requestId:", requestId)
  console.log("Event requestId:", payload.requestId)
})
```

**Check Backend Logs:**

```bash
cd backend
npm run dev
# Look for: "generation started: req_abc123"
#         "emitting to room: generation:req_abc123"
```

### Connection Refused

**Cause:** Backend not running or wrong URL.

**Solution:**

```bash
# Check backend is running
cd backend && npm run dev

# Verify Socket URL
echo "VITE_SOCKET_URL=$(grep VITE_SOCKET_URL .env)"
# Expected: http://localhost:3001 or your backend URL
```

### High Memory Usage

**Cause:** Sockets not disconnecting on cleanup.

**Fix:** Ensure hook returns cleanup function:

```typescript
// ✓ Correct
useEffect(() => {
  const socket = io(...)
  return () => {
    socket.disconnect()  // IMPORTANT: cleanup
  }
}, [requestId])
```

---

## Security Considerations

### Token Storage

- `authToken` stored in `localStorage` is **vulnerable to XSS attacks**.
- Never store sensitive data (passwords, refresh tokens) in `localStorage`.
- **Recommended:** Use `httpOnly` cookies for tokens in production.

### Bypass Mode

- **Never** enable `VITE_SOCKET_BYPASS=true` in production.
- Bypass mode disables authentication; any client can connect.
- Use **only for local development**.

### CORS

- Socket.IO respects browser CORS rules on HTTP upgrade.
- Backend must validate `origin` header and reject cross-domain connections.
- Use **same-site origin** in production; avoid `*` CORS policy.

---

## Performance Tips

1. **Reuse connections** — Don't create new sockets per request. Reuse via stable `requestId`.
2. **Batch events** — Request backend to batch multiple small updates into larger events.
3. **Cleanup thoroughly** — Always disconnect on unmount and route transitions.
4. **Transport priority** — Keep `transports: ["websocket", "polling"]` (WebSocket is much faster).
5. **Debounce updates** — If receiving many events, debounce UI updates:

```typescript
const debouncedOnEvent = useMemo(
  () => debounce((event: GenerationLifecycleEvent) => {
    // Update UI
  }, 300),
  []
)

useGenerationSocket({
  onEvent: debouncedOnEvent,
  // ...
})
```

---

## Related Files

| File | Purpose |
|------|---------|
| [`src/api/socket.ts`](src/api/socket.ts) | Socket.IO URL and auth helpers |
| [`src/hooks/useGenerationSocket.ts`](src/hooks/useGenerationSocket.ts) | React hook for generation lifecycle |
| [`src/types/generate.ts`](src/types/generate.ts) | TypeScript types for generation events |
| [`package.json`](package.json) | Dependencies (socket.io-client 4.8.3) |
| [`.env.example`](.env.example) | Environment variable template |

---

## Further Reading

- **Socket.IO Client Docs:** https://socket.io/docs/v4/client-api/
- **Socket.IO Server Docs:** https://socket.io/docs/v4/server-api/
- **TanStack Start Docs:** https://tanstack.com/start/latest
- **TanStack Router Docs:** https://tanstack.com/router/latest
- **Vite Environment Variables:** https://vitejs.dev/guide/env-and-modes.html

---

## Next Steps

1. ✅ Verify Socket.IO is installed: `npm list socket.io-client`
2. ✅ Check backend is running: `cd backend && npm run dev`
3. ✅ Set up `.env.local` with correct Socket.IO URL
4. ✅ Test connection with browser DevTools (check Network → WS)
5. ✅ Verify generation flow end-to-end
