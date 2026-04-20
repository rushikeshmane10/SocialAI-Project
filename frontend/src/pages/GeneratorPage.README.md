# GeneratorPage — design & UI notes

Short reference for how this screen is built and which design system it follows.

## Design system source

- **Tokens & global rules:** [`src/index.css`](../index.css) (`:root` variables, Inter font, **light-only** — no dark theme).
- **Layout & components:** [`src/App.css`](../App.css) (shell, compose, cards, buttons, banners, **variation modal** block at the bottom).

GeneratorPage does **not** define its own colors or spacing literals; it uses the shared classes above so it stays consistent with Login, Preferences, etc.

## Visual language (theme)

| Aspect | Practice |
|--------|----------|
| **Palette** | Black & white + **ink** grays (`--ink-900` … `--ink-50`). No brand color accent; primary actions use **black** (`--accent`) on white. |
| **Background** | `--white` surfaces; subtle gray (`--ink-50` / `--ink-100`) for nested areas (e.g. modal cards). |
| **Text** | Headings `--black`; body `--ink-900`; secondary / hints `--ink-500`, `--ink-400`. |
| **Borders** | Default `--border` (light gray); stronger emphasis uses `--border-dark` (e.g. modal frame). |
| **Feedback** | Errors: `.banner.error` (existing pattern). Success / info: `.banner` without error. |

## Typography

- **Font:** `Inter` stack (`--font`).
- **Scale:** `--text-xs` through `--text-xl` (and larger for marketing elsewhere). Page title uses `.page-title` (`--text-lg`, bold).
- **Tone:** Tight letter-spacing on headings (`variation-modal-title`); uppercase micro-labels via `.card-label` pattern elsewhere.

## Spacing & rhythm

- **Scale:** `--s1` (4px) … `--s9` (64px) — use these in new CSS, not arbitrary `px`.
- **Sections:** `.compose-box` = vertical stack with gap `--s3`; horizontal clusters use `.row` / `.row.end` where applicable.
- **Page chrome:** `.main` + `.page-header` (sticky, blurred white bar) matches the rest of the app.

## Motion

- **Easing:** `--ease` (`cubic-bezier(0.2, 0, 0, 1)`).
- **Duration:** `--fast` (150ms) for hovers/transitions; modal cards use short lift on hover.

## Shape & depth

- **Radius:** Mostly sharp X-like UI; **exceptions** use `--radius-sm` / `--radius-md` (modal panel, images, badges).
- **Elevation:** Modal uses layered **box-shadow** + thin inner highlight; backdrop uses **blur** + semi-transparent black (not a token — scoped to `.variation-modal-backdrop`).

## Layout patterns on this page

| Pattern | Usage |
|---------|--------|
| `.app-shell` | Two-column grid: nav rail + main (collapses on narrow viewports per `App.css`). |
| `.compose-lead` | Intro copy under the title — max width, muted color. |
| `.compose-box` | Grouped form + messages (generate block, tweet block). |
| `.feed` | Vertical stack for preview + status. |
| `.divider` | Full-width section break. |

## Components & composition

- **Presentational:** `TopicForm`, `TweetPreview`, `StatusBanner`, `SatisfactionPrompt` — receive state/handlers only; styling comes from shared classes inside those files + `App.css`.
- **Modal:** [`VariationPickerModal`](../components/VariationPickerModal.tsx) — **portal** to `document.body`, `role="dialog"`, `aria-labelledby`, **Escape** + backdrop close, **scroll lock** on `body` while open. Preview image URL is fixed in the component (Pexels hero + per-card thumbs).

## Buttons

- **Primary:** `.btn.primary` (post, confirm variant).
- **Secondary / quiet:** `.btn.muted`, `.btn.ghost`.
- **Disabled:** `disabled` + optional `title` for why (e.g. Post locked until a variant is chosen).

## UX rules reflected in UI (not visual tokens)

- **Post to X** stays disabled until a variant is saved (`readyToPost`) — communicated with helper `.form-hint` and button `title`.
- **Generate** opens the variation modal; closing without a pick clears that generation’s draft state (no orphan `postId`).

## When adding UI here

1. Reuse **`App.css`** classes before inventing new ones.
2. New page-specific layout → prefer a **scoped block** in `App.css` (like `.variation-modal-*`) with **token variables** for colors/spacing/radius.
3. Keep **contrast** on white; avoid colored backgrounds except error banners.
4. Match **accessibility**: labels on inputs, `role` / `aria-*` on dialogs, keyboard dismiss where implemented.

## File map

| File | Role |
|------|------|
| [`GeneratorPage.tsx`](GeneratorPage.tsx) | Page structure, state, wiring — almost no local `className` invention beyond what’s already in the tree. |
| [`VariationPickerModal.tsx`](../components/VariationPickerModal.tsx) | Modal markup + behavior; styling entirely via `.variation-modal-*` in `App.css`. |
