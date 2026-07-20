import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useState } from "react";
import { motion } from "framer-motion";
import { useLoading } from "@/components/LoadingOverlay";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Social AI" },
      { name: "description", content: "Sign in to your Social AI account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const { withLoader } = useLoading();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/preferences" />;
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


  return (
    <div className="flex min-h-screen bg-background">
      {/* Theme toggle — top right */}
      <div className="fixed right-5 top-5 z-10">
        <ThemeToggle />
      </div>

      {/* Left panel — Stripe-style gradient mesh */}
      <div className="hidden w-[48%] lg:flex relative overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 bg-[image:var(--gradient-mesh)] opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />

        {/* Content overlay */}
        <div className="relative z-10 flex items-end p-12 pb-16">
          <div>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-white">Social AI</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
              Generate, refine, and publish content that connects — powered by AI that understands
              your voice.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[360px]"
        >
          {/* Mobile wordmark */}
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[image:var(--gradient-primary)]" />
              <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
                Social AI
              </h1>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">
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
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/50 transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/50 transition-all duration-150 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all duration-150 hover:shadow-[var(--shadow-elevated)] hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button className="text-muted-foreground transition-colors duration-150 hover:text-foreground">
              Create new account
            </button>
            <button className="text-muted-foreground transition-colors duration-150 hover:text-foreground">
              Forgot password?
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
