import { Link, useRouterState } from "@tanstack/react-router";
import { PenLine, Link2, Settings, LogOut, ChevronsLeft, ChevronsRight, User, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "social-ai-nav-collapsed";

const navItems = [
  { title: "Post to social media", url: "/", icon: PenLine },
  { title: "Connections", url: "/connections", icon: Link2 },
  { title: "LinkedIn Profile", url: "/linkedin-profile", icon: User },
  { title: "Template Library", url: "/template-library", icon: BookOpen },
  { title: "Preferences", url: "/preferences", icon: Settings },
];

export function AppNavRail() {
  const { user, logout } = useAuth();
  const currentPath = useRouterState({
    select: (s) => s.location.pathname,
  });

  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const initial = user?.name?.charAt(0).toUpperCase() || "U";

  const rail = (
    <nav
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-6 transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
        collapsed ? "w-[72px]" : "w-[220px]",
        !hydrated && "w-[220px]",
      )}
    >
      <div
        className={cn(
          "mb-8 flex shrink-0 items-center gap-2 px-3",
          collapsed ? "flex-col justify-center" : "justify-between",
        )}
      >
        <Link
          to="/"
          className={cn(
            "flex items-center gap-2 rounded-lg transition-opacity duration-300 ease-in-out",
            collapsed ? "justify-center px-0" : "px-1",
          )}
        >
          <div className="h-6 w-6 shrink-0 rounded-md bg-[image:var(--gradient-primary)]" />
          <span
            className={cn(
              "font-heading text-[15px] font-bold tracking-tight text-sidebar-foreground transition-all duration-300 ease-in-out motion-reduce:transition-none",
              collapsed ? "pointer-events-none w-0 overflow-hidden opacity-0" : "opacity-100",
            )}
          >
            Social AI
          </span>
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            collapsed && "mt-1",
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 px-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.url;
          const linkClass = cn(
            "flex items-center rounded-lg py-2.5 text-[13px] font-medium transition-colors duration-200",
            collapsed ? "justify-center px-0" : "gap-3 px-3",
            isActive
              ? "bg-sidebar-accent text-sidebar-foreground shadow-[var(--shadow-sm)]"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          );

          const inner = (
            <Link to={item.url} className={linkClass}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  "truncate transition-all duration-300 ease-in-out motion-reduce:transition-none",
                  collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100",
                )}
              >
                {item.title}
              </span>
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.url}>
                <TooltipTrigger asChild>{inner}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.url}>{inner}</div>;
        })}
      </div>

      <div className="mt-auto shrink-0 px-2">
        <div className="border-t border-sidebar-border pt-4">
          <div
            className={cn(
              "flex items-center gap-3 px-1 transition-all duration-300 ease-in-out",
              collapsed && "flex-col justify-center gap-2",
            )}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[image:var(--gradient-accent)] text-xs font-semibold text-white">
              {initial}
              <div className="absolute -right-0 -bottom-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
            </div>
            <div
              className={cn(
                "min-w-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none",
                collapsed ? "hidden h-0 w-0 opacity-0" : "opacity-100",
              )}
            >
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-3 flex w-full items-center justify-center rounded-lg py-2 text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Sign out
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  return <TooltipProvider delayDuration={200}>{rail}</TooltipProvider>;
}
