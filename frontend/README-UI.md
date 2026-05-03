# Frontend UI overview

This document describes the React UI: **routes**, **pages**, and **controls** (buttons, forms, modals). It does not describe stylesheets or design tokens.

## App shell and routing

- **Router:** `BrowserRouter` wraps the app in `main.tsx`. `AuthProvider` supplies authentication state to all routes.
- **Route table** (`App.tsx`):

| Path | Page | Access |
|------|------|--------|
| `/login` | `LoginPage` | Public. If already signed in, redirects to `/preferences`. |
| `/preferences` | `PreferencesPage` | **Protected** — unauthenticated users are sent to `/login`. |
| `/connections` | `ConnectionsPage` | **Protected** |
| `/` | `GeneratorPage` | **Protected** |
| `*` (anything else) | — | Redirects to `/`. |

**Protected routes** use the same pattern as `ProtectedRoute` in `App.tsx`: if `isAuthenticated` is false, render `<Navigate to="/login" replace />` instead of the page.

There is also a `components/ProtectedRoute.tsx` helper (uses `<Outlet />`) that is **not** wired into `App.tsx` today; routing protection is implemented inline in `App.tsx`.

## Layout used on authenticated pages

Most signed-in screens share:

- **`AppNavRail`** (left rail): wordmark link to `/`, nav links **Post to X** (`/`), **Connections** (`/connections`), **Preferences** (`/preferences`), user avatar initial + email line, **Sign out** (clears session and navigates to `/login`).
- **`ThemeToggle`** in the page header where shown: toggles light/dark preference (stored in `localStorage`, class on `document.documentElement`).

---

## Login (`/login`) — `LoginPage`

- **Header:** “Social AI” wordmark area + `ThemeToggle`.
- **Card:** title “Welcome back”, subtitle “Sign in to your account.”
- **Form:** Email field, password field, **Sign in** submit (shows “Signing in…” while busy). Error message area on failure.
- **Other controls:** **Create new account** (button, no handler wired in code as shown), **Forgot password?** (button/link-style, no handler wired).

---

## Preferences (`/preferences`) — `PreferencesPage`

- **Header:** “Preferences” + `ThemeToggle`.
- **Intro copy** explaining that answers are saved to the profile.
- **Load state:** loading message, or error banner if fetch fails.
- **Saved preferences** (after load): read-only cards for each configured question (`profession`, `audience`, `vibe` from `config/preferenceQuestions.ts`).
- **Form:** One card per question — label, optional helper text, textarea, placeholders from config.
- **Submit:** **Save** — disabled until every question is non-empty, or while loading/saving; navigates to `/` on success.

---

## Connections (`/connections`) — `ConnectionsPage`

- **Header:** “Social connections” + `ThemeToggle`.
- **Intro** about OAuth and verify.
- **Banners:** load errors, action errors.
- **Twitter card:** status (Connected / Not connected), description, **Connect Twitter**, **Verify** (disabled when already connected or while another action runs).
- **LinkedIn card:** same pattern — **Connect LinkedIn**, **Verify**.
- **Note** about optional `?verify=twitter` or `?verify=linkedin` query params (auto-verify on return from OAuth).
- **Back to generator** → navigates to `/`.

Query `?verify=twitter` or `?verify=linkedin` triggers an automatic verify flow on mount.

---

## Generator / home (`/`) — `GeneratorPage`

- **`AppNavRail`** + main column titled **“Post to X”** (header also has `ThemeToggle` and **Reset** — clears topic, tones, draft, generation state, and closes the variation flow).

**AI topic block**

- Banners: generation error, status/success messages, pick errors (when modal closed).
- **`SatisfactionPrompt`** (card): after a variation is chosen, asks “how close” with **Yes**, **Almost**, **Not really**, **skip**; fires feedback then dismisses.
- **`TopicForm`:**
  - Topic textarea (“What’s happening?”).
  - **Tone selection:** exactly two tones from pills — `professional`, `casual`, `humorous`, `inspirational`, `controversial`; selected tones show as chips with **×** to remove.
  - **Model** `<select>` — options from `config/llmModels.ts` (`LLM_MODEL_OPTIONS`).
  - **Generate →** — starts mock/async generation (disabled while generating or waiting on socket); can show a quiet busy state.

**`VariationPickerModal`** (portal dialog over the page)

- Opens while waiting for generation and when two variations are ready.
- **Backdrop** click and **Close** button dismiss; **Escape** closes.
- **Loading:** two skeleton “option” cards and subtitle mentioning the selected model when applicable.
- **Ready:** two cards — image (or “Image unavailable”), tone tag, text, hashtags, **Use this variant** (disabled if draft cannot be persisted yet), **Regenerate from this option…** which expands to a rework textarea, character hint, **Cancel**, **Regenerate with AI**.
- Optional error / “connect the database” style notices inside the modal.

**Draft**

- Large textarea for post body (“Write your post…”), editable unless posting.

**Preview and post**

- **`TweetPreview`:** read-only preview of draft, character count vs 280, slot for actions.
- **Post to X →** — primary post action (disabled until a variant is selected and persisted; shows busy state while posting).
- **`StatusBanner`:** errors after post attempt; optional success line with **Open tweet** link when `successUrl` is set (the current generator flow mostly sets messages via other state; the banner supports posting / done phases).

**Real-time generation:** `useGenerationSocket` listens for completion by `requestId` and then opens the modal with variations.

---

## Floating / global UI (outside page trees)

- **`TestImagePostButton`** (`App.tsx`): when authenticated, a fixed **Test Image Post** control runs a LinkedIn image-post test API; shows success or error text. Marked as test-only in code.

---

## Components present but not on a route today

- **`ImagePanel`:** image URL / prompt / base64 display helper — **not imported** by any current page.
- **`ProtectedRoute`:** outlet-based guard — **not used** in `App.tsx` (inline guard is used instead).

---

## Summary list of UI modules

| Module | Role |
|--------|------|
| `App.tsx` | Routes, theme bootstrap on load, test button gate |
| `pages/LoginPage` | Sign-in form |
| `pages/PreferencesPage` | Profile-style questions + save |
| `pages/ConnectionsPage` | Twitter / LinkedIn OAuth + verify |
| `pages/GeneratorPage` | Full compose + generate + modal + post flow |
| `components/AppNavRail` | Primary navigation + sign out |
| `components/ThemeToggle` | Theme switch |
| `components/TopicForm` | Topic, tones, model, generate |
| `components/VariationPickerModal` | Full-screen modal for two drafts + rework |
| `components/SatisfactionPrompt` | Quick satisfaction buttons |
| `components/TweetPreview` | Preview + count + actions slot |
| `components/StatusBanner` | Post status / error / link |
| `components/TestImagePostButton` | Dev test trigger (authenticated) |
