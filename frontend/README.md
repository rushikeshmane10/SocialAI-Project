# Frontend — UI & design

This document describes how the **SociaAI** frontend is styled, structured, and themed. The UI is **custom CSS** (no Tailwind, no component library like MUI or Chakra). Visual language is **X (Twitter)–inspired**: narrow feed column, sticky header, pill navigation, composer card, and a dedicated **dark mode** that mirrors X’s black UI while keeping product accents (lavender CTAs, X blue for nav highlights).

---

## Stack (relevant to UI)

| Piece | Choice |
|--------|--------|
| Framework | **React 19** + **TypeScript** |
| Build | **Vite 8** |
| Routing | **react-router-dom** v7 |
| Realtime | **socket.io-client** (generation lifecycle; not a UI library) |
| Styling | **Global CSS** — two layers: design tokens + reset in `src/index.css`, application/layout/components in `src/App.css` |
| Fonts | **Inter** (Google Fonts), loaded in `index.html` and mirrored in `index.css` `@import` |

There is **no** CSS-in-JS, CSS Modules, or utility-first framework for the main app chrome.

---

## Design philosophy

1. **Feed-first layout** — Centered shell (`max-width: 1280px`), two-column grid on desktop: **left rail (275px)** + **main**. On small viewports the rail becomes a horizontal strip.
2. **Readable, confident typography** — Inter with negative letter-spacing on titles; weights 400–900 used intentionally.
3. **Minimal chrome** — Thin `#e7e7e7` borders (light), subtle shadows on cards/composer; dark theme uses near-black surfaces and `#2a2a2a` borders.
4. **Primary actions** — Lavender/violet **accent** for fills, focus rings, and tone chips; **X blue** (`#1d9bf0`) for “Post to X” and preferences nav affordances (not swapped in dark mode).
5. **Motion** — Short transitions (`--fast` 150ms, `--mid` 200ms) with `cubic-bezier(0.2, 0, 0, 1)`; staggered `animate-in` on login card; skeleton **shimmer** for loading; `prefers-reduced-motion` respected in variation modal skeletons.

---

## Where styles live

| File | Role |
|------|------|
| [`src/index.css`](src/index.css) | **Design tokens** (`:root`), **dark token overrides** (`html.theme-x`), CSS reset, base `body` / headings / `#root`, Inter import |
| [`src/App.css`](src/App.css) | **All UI patterns**: shell, nav, pages, forms, buttons, banners, modals, theme-specific overrides, responsive rules |
| [`index.html`](index.html) | Inter preconnect + stylesheet; **inline script** adds `theme-x` before paint if `localStorage.theme-preference === "dark"` (avoids flash of wrong theme) |
| [`src/App.tsx`](src/App.tsx) | On mount, syncs `theme-x` from `localStorage` or `prefers-color-scheme: dark` |

Component **TSX** files mostly apply **semantic class names** from `App.css` (e.g. `compose-box`, `nav-item`, `btn primary`). Some small UI (e.g. [`ThemeToggle.tsx`](src/components/ThemeToggle.tsx)) uses **inline styles** for animated icon layering.

---

## Theming: light vs “X dark”

- **Light** — Default `:root` tokens; white/off-white backgrounds, dark ink text.
- **Dark** — `document.documentElement` gets class **`theme-x`**. Many components are restyled under `html.theme-x` in `App.css`; **`index.css`** also redefines CSS variables so shared utilities (borders, ink steps, accent inversion) stay consistent.

**Persistence**

- Key: **`theme-preference`** in `localStorage`
- Values: **`"dark"`** or **`"light"`**

**Bootstrap order**

1. `index.html` snippet runs first (dark flash prevention).
2. `App.tsx` `useEffect` applies class from storage or system preference if storage is empty.

**`ThemeToggle` component**

- Toggles `theme-x` and updates `localStorage`.
- Renders a **single control** (sun/moon + decorative stars) with inline animation; not the segmented “Light / Dark” pill described in `App.css` (those `.theme-toggle-pill*` classes are **styling hooks** if you add a segmented control later).

---

## Design tokens (`:root` in `index.css`)

### Neutrals (light)

Semantic names mirror “ink on paper”: `--white`, `--black`, `--ink-50` … `--ink-900`. Use these via `var(--ink-500)` etc., not hard-coded grays in new code when possible.

### Accent (lavender / violet)

Used for primary buttons, focus rings, tone UI, compose accents, connection cards tint:

- `--accent`, `--accent-hover`, `--accent-strong`, `--accent-mid`, `--accent-subtle`, `--accent-soft`

### X blue (nav / brand moments)

- `--x-blue`, `--x-blue-hover`, `--x-blue-surface`, `--x-blue-surface-strong`, `--x-blue-glow`

### Typography scale (`--text-*`)

`--text-xs` through `--text-2xl`, plus `--text-hero`. Body default is `--text-base` (~0.9375rem).

### Spacing (`--s1` … `--s9`)

4px grid: `--s1` = 4px, `--s2` = 8px, … `--s9` = 64px.

### Radii

- `--radius-sm`: 4px  
- `--radius-md`: 8px  
- `--radius-full`: pill (9999px)

### Borders

- `--border` — default hairline  
- `--border-dark` — stronger edge (e.g. modal)

### Motion

- `--ease`: `cubic-bezier(0.2, 0, 0, 1)`  
- `--fast`: 150ms  
- `--mid`: 200ms  

### Font stack

```text
--font: "Inter", -apple-system, BlinkMacSystemFont, sans-serif
```

Dark mode **inverts** many semantic tokens under `html.theme-x` so components using `var(--white)` / `var(--ink-900)` flip meaning (e.g. “white” becomes black canvas, “ink-900” becomes light text). X blue variables stay **literal blues** for recognition.

---

## Layout vocabulary

| Class / region | Behavior |
|----------------|----------|
| `.app-shell` | CSS grid: `275px 1fr`, max-width 1280px, vertical borders. **≤900px**: single column; nav not sticky full height |
| `.nav-rail` | Left column: logo, main nav, footer (user + sign out). **Mobile**: row wrap, bottom border |
| `.main` | Scrollable content; page header + feed/compose |
| `.page-header` | Sticky top bar, blurred translucent background (light); solid black in `theme-x` |
| `.feed` | Vertical stack; cards get rounded border + light shadow when inside `.main > .feed` |
| `.settings-shell` / `.settings-shell--embedded` | Preferences layout; embedded variant removes side borders inside app shell |
| `.pref-page`, `.connections-page` | Page-level horizontal margin `var(--s4)` + vertical rhythm |

---

## Reusable UI patterns (class cheat sheet)

Use existing classes before inventing new ones.

### Buttons

- `.btn` + `.primary` | `.ghost` | `.muted`  
- Modifiers: `.lg`, `.full`

### Forms

- `.field`, `.label`  
- `.input`, `textarea`, `select` — global in `App.css`  
- `.input-ghost` — borderless composer style; compose card variants `#tweet-draft` / `#topic` add borders and backgrounds

### Tone picker

- `.tone-field`, `.tone-pills`, `.tone-pill`, `.tone-pill--selected`, `.tone-pill--blocked`  
- `.tone-chip`, `.tone-chip-remove`

### Feedback

- `.banner`, `.banner.error`, `.banner.ok`  
- `.status`-style messaging often uses these patterns (see `StatusBanner` + usages)

### Content

- `.card`, `.card-label`  
- `.compose-box`, `.compose-row`, `.compose-avatar`, `.compose-body`, `.compose-generate-row`  
- `.preview` — tweet body preview  
- `.count`, `.count.bad` — character count / over limit

### Media

- `.image-frame` — 16:9, rounded, skeleton-friendly  
- `.skeleton`, `.skeleton--tall` — shimmer loading

### Utilities

- `.row`, `.row.spread`, `.row.end`  
- `.meta`, `.meta--center`  
- `.animate-in` — staggered fade-up on mount

### Modals

- `.variation-modal-*` — full-screen overlay, backdrop blur, panel, grid of variation cards, rework section

### Login

- `.login-page`, `.login-page-inner`, `.login-page-card`, `.login-page-title`, …  
- Dark overrides under `html.theme-x .login-page` … in `App.css`

### Connections

- `.connections-grid`, `.connection-card`, `.connection-status.is-connected` / `.is-disconnected`

---

## Breakpoints (from `App.css`)

| Approx width | Notable change |
|--------------|----------------|
| **900px** | App shell single column; nav rail layout switch |
| **860px** | Connections grid → one column |
| **720px** | Preferences saved grid → one column; variation modal grid → one column |

---

## Pages & composition (high level)

| Route | Primary classes / components |
|-------|-------------------------------|
| `/login` | `LoginPage` — `login-page`, card, `ThemeToggle`, standard fields + `btn primary` |
| `/` | `GeneratorPage` — `app-shell`, `AppNavRail`, `page-header`, `compose-box`, `TopicForm`, `TweetPreview`, `VariationPickerModal`, banners |
| `/preferences` | `PreferencesPage` — `pref-page`, `settings-*`, `pref-card`, saved grid |
| `/connections` | `ConnectionsPage` — `connections-page`, `connection-card` |

Navigation and chrome are centralized in [`AppNavRail.tsx`](src/components/AppNavRail.tsx) (wordmark, Post to X, Connections, Preferences, user block, sign out).

---

## Accessibility & UX details baked into CSS

- **Focus** — `focus-visible` rings on inputs, tone pills, model select (violet-tinted shadows).  
- **Nav** — Sign-out row can hide until footer hover on fine pointers (`@media (hover: hover)`); always available on touch.  
- **Theme toggle** — `aria-label` / `aria-pressed` in `ThemeToggle`.  
- **Reduced motion** — variation modal loading skeleton animation disabled when `prefers-reduced-motion: reduce`.  
- **Safe area** — login page padding respects `env(safe-area-inset-bottom)`.

---

## Adding new UI

1. **Prefer tokens** from `index.css` (`--ink-*`, `--accent-*`, `--s*`, `--text-*`, `--radius-*`, `--border`).  
2. **Add layout/component rules** to `App.css`; group with comment headers like existing sections.  
3. **Dark mode** — Either rely on inverted CSS variables, or add explicit `html.theme-x` rules if you introduce hard-coded light colors.  
4. **Avoid** scattering one-off hex colors unless they are status colors (greens/reds) already used for banners/status pills.  
5. **Icons** — Inline SVGs in TSX with `currentColor` where possible so `theme-x` nav colors apply.

---

## Running the app

```bash
npm install
npm run dev
```

Build: `npm run build` (runs `tsc -b` then `vite build`). Lint: `npm run lint`.

---

## Summary

The frontend UI is a **token-driven, X-inspired** design system implemented as **global CSS** in **`index.css`** (tokens + reset + dark variable flip) and **`App.css`** (components and `html.theme-x` overrides). **Inter** is the sole UI font. **Theme** is toggled via **`html.theme-x`** and **`localStorage.theme-preference`**. New work should **reuse established class names** and **CSS variables** so light and dark modes stay visually coherent.
