import { useEffect, useState } from "react";

const STORAGE_KEY = "theme-preference";

function isDark(): boolean {
  return document.documentElement.classList.contains("theme-x");
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? isDark() : false
  );

  useEffect(() => {
    setDark(isDark());
  }, []);

  function toggle() {
    const nextDark = !dark;
    const root = document.documentElement;
    root.classList.toggle("theme-x", nextDark);
    try { localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light"); } catch {}
    setDark(nextDark);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      style={{
        position: "relative",
        width: 36,
        height: 36,
        padding: 0,
        border: "none",
        borderRadius: 8,
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
      }}
    >
      {/* Stars (visible in dark mode) */}
      {[
        { size: 2, top: 6, left: 10, delay: "0.05s", color: "#e8e0ff" },
        { size: 2, top: 11, left: 6, delay: "0.12s", color: "#cce4ff" },
        { size: 1.5, top: 16, left: 11, delay: "0.18s", color: "#e8e0ff" },
        { size: 2, top: 9, left: 24, delay: "0.08s", color: "#cce4ff" },
      ].map((s, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: s.color,
            top: s.top,
            left: s.left,
            opacity: dark ? 1 : 0,
            transform: dark ? "scale(1)" : "scale(0)",
            transition: `opacity 0.4s ease ${s.delay}, transform 0.5s cubic-bezier(.34,1.56,.64,1) ${s.delay}`,
          }}
        />
      ))}

      {/* Sun icon */}
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        style={{
          position: "absolute",
          opacity: dark ? 0 : 1,
          transform: dark ? "rotate(90deg) scale(0.4)" : "rotate(0deg) scale(1)",
          transition: "transform 0.6s cubic-bezier(.34,1.56,.64,1), opacity 0.4s ease",
        }}
      >
        <circle cx="12" cy="12" r="4.5" fill="#f4a124" />
        {[
          ["12","2","12","5"], ["12","19","12","22"],
          ["2","12","5","12"], ["19","12","22","12"],
          ["4.93","4.93","7.05","7.05"], ["16.95","16.95","19.07","19.07"],
          ["19.07","4.93","16.95","7.05"], ["4.93","19.07","7.05","16.95"],
        ].map(([x1,y1,x2,y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#f4a124" strokeWidth="2" strokeLinecap="round"
            style={{ transition: `opacity 0.3s ease ${i * 0.02}s` }} />
        ))}
      </svg>

      {/* Moon icon */}
      <svg
        width="19" height="19" viewBox="0 0 24 24" fill="none"
        style={{
          position: "absolute",
          opacity: dark ? 1 : 0,
          transform: dark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0.4)",
          transition: "transform 0.6s cubic-bezier(.34,1.56,.64,1), opacity 0.4s ease",
        }}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="#6b8cff" />
      </svg>
    </button>
  );
}