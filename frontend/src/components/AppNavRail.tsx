import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function accountInitial(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0]?.trim() ?? "";
  const m = local.match(/[a-zA-Z0-9]/);
  return m ? m[0].toUpperCase() : "?";
}

export function AppNavRail() {
  const { logout, userEmail, userId } = useAuth();
  const navigate = useNavigate();
  const initial = accountInitial(userEmail);
  const emailLine = userEmail ?? (userId ? "Signed in" : "");

  return (
    <aside className="nav-rail">
      <div className="nav-rail-main">
        <div className="nav-logo">
          <Link className="wordmark" to="/">
            Social AI
          </Link>
        </div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item nav-item--post-x${isActive ? " nav-item--post-x-active" : ""}`}
        >
          <svg
            className="nav-item-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M12 20h9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Post to X</span>
        </NavLink>
        <NavLink
          to="/connections"
          className={({ isActive }) => `nav-item nav-item--prefs${isActive ? " nav-item--prefs-active" : ""}`}
        >
          <svg
            className="nav-item-icon nav-item-icon--prefs"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
            <path
              d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Connections</span>
        </NavLink>
        <NavLink
          to="/preferences"
          className={({ isActive }) => `nav-item nav-item--prefs${isActive ? " nav-item--prefs-active" : ""}`}
        >
          <svg
            className="nav-item-icon nav-item-icon--prefs"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>Preferences</span>
        </NavLink>
      </div>

      <div className="nav-rail-footer">
        <div className="nav-user" title={userEmail ?? userId ?? undefined}>
          <span className="nav-user-avatar" aria-hidden>
            {initial}
          </span>
          <span className="nav-user-email">{emailLine}</span>
        </div>
        <button
          type="button"
          className="nav-item nav-item--signout"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
