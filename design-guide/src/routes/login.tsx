import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import { motion } from "framer-motion";
import { useLoading } from "@/components/LoadingOverlay";
import { Eye, EyeOff } from "lucide-react";
import img1 from "../../public/Images/iffany-woman-8643502_1920.png"
import img2 from "../../public/Images/shimabdinzade-woman-8378634_1920.jpg"
import img3 from "../../public/Images/ppp153-girl-3820661_1920.jpg"
import img4 from "../../public/Images/rayul-_M6gy9oHgII-unsplash.jpg"
import img5 from "../../public/Images/petahmayer-male-2634974_1920.jpg"


export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Social AI" },
      { name: "description", content: "Sign in to your Social AI account." },
    ],
  }),
  component: LoginPage,
});
type OrbitStyle = React.CSSProperties & {
  "--angle"?: string;
  "--radius"?: string;
  "--size"?: string;
};
function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const { withLoader } = useLoading();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false)
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await withLoader(() => login(email.trim(), password));
      void navigate({ to: "/", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };



const orbitStyle = (angle: string, radius: string, size: string): OrbitStyle => ({
  "--angle": angle,
  "--radius": radius,
  "--size": size,
});
 
const CENTER = 290;
 
function pointOnRing(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    left: CENTER + radius * Math.cos(rad),
    top: CENTER + radius * Math.sin(rad),
  };
}
 
const faces = [
  { src: img1, angle: 20, radius: 125, size: 62 },
  { src: img2, angle: 190, radius: 125, size: 56 },
 
  { src: img3, angle: 60, radius: 205, size: 68 },
  { src: img4, angle: 250, radius: 205, size: 58 },
  { src: "https://randomuser.me/api/portraits/women/23.jpg", angle: 330, radius: 205, size: 52 },
 
  { src: "https://randomuser.me/api/portraits/men/45.jpg", angle: 10, radius: 275, size: 64 },
  { src: "https://randomuser.me/api/portraits/women/54.jpg", angle: 130, radius: 275, size: 56 },
  { src: "https://randomuser.me/api/portraits/men/22.jpg", angle: 210, radius: 275, size: 50 },
  { src: "https://randomuser.me/api/portraits/women/38.jpg", angle: 290, radius: 275, size: 60 },
];
  return (
 <div className="flex min-h-screen bg-background">
      {/* Theme toggle — top right */}
      <div className="fixed right-5 top-5 z-10">
        <ThemeToggle />
      </div>
 
      {/* Left panel — Organic Network Clusters, equal width */}
     <div className="hidden w-1/2 lg:flex flex-col items-center justify-center bg-white">
      <div className="ring-wrapper">
        <div className="ring-cloud">
          <svg className="ring-svg" viewBox="0 0 580 580">
            <circle cx="290" cy="290" r="125" className="ring-path" />
            <circle cx="290" cy="290" r="205" className="ring-path" />
            <circle cx="290" cy="290" r="275" className="ring-path" />
          </svg>
 
          {faces.map((f, i) => {
            const { left, top } = pointOnRing(f.angle, f.radius);
            return (
              <img
                key={i}
                src={f.src}
                alt=""
                className="ring-face"
                style={{
                  left,
                  top,
                  width: f.size,
                  height: f.size,
                }}
              />
            );
          })}
 
          <div className="ring-core">
            <img
              className="ring-core-face ring-core-face-1"
              src="https://randomuser.me/api/portraits/women/44.jpg"
              alt="User"
            />
            <img
              className="ring-core-face ring-core-face-2"
              src="https://randomuser.me/api/portraits/men/32.jpg"
              alt="User"
            />
          </div>
        </div>
      </div>
 
      <style>{`
        .ring-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
 
        .ring-cloud {
          position: relative;
          width: 580px;
          height: 580px;
          max-width: 90%;
          max-height: 90%;
        }
 
        .ring-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
 
        .ring-path {
          fill: none;
          stroke: #d8dee8;
          stroke-width: 1;
        }
 
        .ring-face {
          position: absolute;
          border-radius: 50%;
          object-fit: cover;
          transform: translate(-50%, -50%);
          opacity: 1;
          filter: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
          transition: transform 0.2s ease;
        }
 
        .ring-face:hover {
          transform: translate(-50%, -50%) scale(1.08);
        }
 
        .ring-core {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 180px;
          height: 180px;
          transform: translate(-50%, -50%);
        }
 
        .ring-core-face {
          position: absolute;
          border-radius: 50%;
          object-fit: cover;
          opacity: 1;
          filter: none;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
          border: 3px solid #ffffff;
        }
 
        .ring-core-face-1 {
          width: 130px;
          height: 130px;
          top: 0;
          left: 0;
          z-index: 2;
        }
 
        .ring-core-face-2 {
          width: 120px;
          height: 120px;
          bottom: 0;
          right: 0;
          z-index: 3;
        }
      `}</style>
    </div>
 
      {/* Right panel — form, equal width */}
      <div className="flex w-full lg:w-1/2 items-center justify-center  py-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[600px] z-10"
        >
          {/* Mobile wordmark */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary" />
              <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
                Social AI
              </h1>
            </div>
          </div>
 
          {/* Auth card */}
          <div className="auth-card p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-on-background">Welcome back</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Sign in to your account to continue
              </p>
            </div>
 
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
 
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold tracking-wide text-secondary ml-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="auth-input-field"
                />
              </div>
 
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label htmlFor="password" className="text-xs font-semibold tracking-wide text-secondary text-gray-400">
                    Password
                  </label>
                  <button type="button" className="text-xs font-semibold text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="auth-input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
 
              <div className="pt-1">
                <button type="submit" disabled={loading} className="auth-btn-primary">
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </div>
            </form>
 
            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant/30" />
              </div>
              <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-widest">
                <span className="auth-divider-label">Or login with</span>
              </div>
            </div>
 
            {/* Social logins */}
            <div className="flex flex-col gap-3">
              <button type="button" className="auth-btn-social">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.11A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
                  <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z" />
                </svg>
                Sign in with Google
              </button>
              <button type="button" className="auth-btn-social">
                <svg className="w-5 h-5" viewBox="0 0 23 23">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
                Sign in with Microsoft
              </button>
            </div>
 
            <p className="mt-8 text-center text-sm text-on-surface-variant">
              Don't have an account?{" "}
              <button type="button" className="font-semibold text-primary hover:underline">
                Create new account
              </button>
            </p>
          </div>
 
          {/* Terms */}
          <p className="mt-6 text-center text-[11px] text-on-secondary-fixed-variant">
            By signing in, you agree to our{" "}
            <a href="#" className="underline hover:text-primary transition-colors">Terms of Service</a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-primary transition-colors">Privacy Policy</a>.
          </p>
        </motion.div>
      </div>
 
      <style>{`
        .onc-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
 
        .onc-cloud {
          position: relative;
          width: 420px;
          height: 420px;
        }
 
        .onc-face {
          position: absolute;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          transform: translate(-50%, -50%);
          transition: transform 0.3s ease;
        }
 
        .onc-face:hover {
          transform: translate(-50%, -50%) scale(1.08);
        }
 
        .onc-core {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 132px;
          height: 132px;
          transform: translate(-50%, -50%);
        }
 
        .onc-core-face {
          position: absolute;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          border: 3px solid #ffffff;
        }
 
        .onc-core-face-1 {
          width: 96px;
          height: 96px;
          top: 0;
          left: 0;
          z-index: 2;
        }
 
        .onc-core-face-2 {
          width: 88px;
          height: 88px;
          bottom: 0;
          right: 0;
          z-index: 3;
        }
      `}</style>
    </div>
  );
}
