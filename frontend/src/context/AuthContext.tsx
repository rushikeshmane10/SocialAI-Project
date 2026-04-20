import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginRequest } from "../api/auth";

type AuthContextValue = {
  userId: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readStoredUserEmail(): string | null {
  try {
    const raw = localStorage.getItem("userEmail")?.trim();
    if (!raw) return null;
    if (!EMAIL_RE.test(raw)) {
      localStorage.removeItem("userEmail");
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function readStoredUserId(): string | null {
  try {
    const raw = localStorage.getItem("userId")?.trim();
    if (!raw) return null;
    if (!UUID_RE.test(raw)) {
      localStorage.removeItem("userId");
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function readInitialAuth(): { userId: string | null; userEmail: string | null } {
  const userId = readStoredUserId();
  if (!userId) {
    try {
      localStorage.removeItem("userEmail");
    } catch {
      /* ignore */
    }
    return { userId: null, userEmail: null };
  }
  return { userId, userEmail: readStoredUserEmail() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState(readInitialAuth);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginRequest({ email, password });
    localStorage.setItem("userId", res.userId);
    localStorage.setItem("userEmail", res.email);
    setAuth({ userId: res.userId, userEmail: res.email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    setAuth({ userId: null, userEmail: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      userId: auth.userId,
      userEmail: auth.userEmail,
      isAuthenticated: Boolean(auth.userId),
      login,
      logout,
    }),
    [auth.userId, auth.userEmail, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with provider
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
