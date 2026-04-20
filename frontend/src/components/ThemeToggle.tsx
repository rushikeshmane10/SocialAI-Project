import { useEffect, useState } from "react";

const STORAGE_KEY = "theme-preference";

function isDark(): boolean {
  return document.documentElement.classList.contains("theme-x");
}

function SunIcon() {
  return (
    <svg className="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="theme-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3a8.5 8.5 0 1 0 11.5 11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => (typeof document !== "undefined" ? isDark() : false));

  useEffect(() => {
    setDark(isDark());
  }, []);

  function applyTheme(nextDark: boolean) {
    if (nextDark === dark) return;
    const root = document.documentElement;
    if (nextDark) {
      root.classList.add("theme-x");
      try {
        localStorage.setItem(STORAGE_KEY, "dark");
      } catch {
        /* private mode / quota */
      }
    } else {
      root.classList.remove("theme-x");
      try {
        localStorage.setItem(STORAGE_KEY, "light");
      } catch {
        /* private mode / quota */
      }
    }
    setDark(nextDark);
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Theme selector">
      <div className="theme-toggle-pill">
        <button
          type="button"
          className="theme-toggle-pill-opt theme-toggle-pill-opt--light"
          data-active={!dark}
          onClick={() => applyTheme(false)}
          aria-pressed={!dark}
          aria-label="Use light theme"
        >
          <MoonIcon />
          <span className="theme-toggle-pill-label">Light</span>
        </button>
        <button
          type="button"
          className="theme-toggle-pill-opt theme-toggle-pill-opt--dark"
          data-active={dark}
          onClick={() => applyTheme(true)}
          aria-pressed={dark}
          aria-label="Use dark theme"
        >
          <SunIcon />
          <span className="theme-toggle-pill-label">Dark</span>
        </button>
      </div>
    </div>
  );
}
