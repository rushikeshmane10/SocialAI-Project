import { Link, useRouterState } from "@tanstack/react-router";
import { PenLine, Link2, Settings, LogOut, ChevronsLeft, ChevronsRight, User, BookOpen, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STORAGE_KEY = "social-ai-nav-collapsed";

const navItems = [
  { title: "Publishing Hub", url: "/", icon: PenLine },
  { title: "Connections", url: "/connections", icon: Link2 },
  { title: "Profile", url: "/linkedin-profile", icon: User },
  { title: "Template Library", url: "/template-library", icon: BookOpen },
  // { title: "Preferences", url: "/preferences", icon: Settings },
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
        "sticky top-0 flex h-screen shrink-0 flex-col bg-white border-r border-gray-100 shadow-premium-subtle py-8 transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
        collapsed ? "w-[88px]" : "w-72",
        !hydrated && "w-72",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "mb-8 flex shrink-0 items-center gap-2 px-6",
          collapsed ? "flex-col justify-center gap-3 px-3" : "justify-between",
        )}
      >
        <Link
          to="/"
          className={cn(
            "flex items-center gap-3 rounded-lg transition-opacity duration-300 ease-in-out",
            collapsed ? "justify-center px-0" : "px-0",
          )}
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-accent-glow">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span
            className={cn(
              "text-xl font-bold tracking-tight text-gray-900 transition-all duration-300 ease-in-out motion-reduce:transition-none",
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
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 border border-transparent transition-colors hover:text-[#4F46E5] hover:bg-gray-50 hover:border-gray-100",
            collapsed && "mt-1",
          )}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Nav items */}
      <div className="flex flex-1 flex-col gap-1 px-4 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = currentPath === item.url;

          const linkClass = cn(
            "flex items-center rounded-xl py-3 text-sm font-medium transition-all duration-200",
            collapsed ? "justify-center px-0" : "gap-4 px-3",
            isActive
              ? "font-bold text-[#4F46E5] bg-[rgba(79,70,229,0.05)] border border-indigo-100 shadow-sm"
              : "text-gray-600 hover:bg-gray-50 hover:text-[#4F46E5]",
          );

          const inner = (
            <div className={cn("relative", !collapsed && isActive && "w-full")}>
              {isActive && !collapsed && (
                <div className="absolute left-[-16px] top-1/2 -translate-y-1/2 active-indicator bg-[#7C3AED]" />
              )}
              <Link to={item.url} className={linkClass}>
                <item.icon
                  className={cn("h-5 w-5 shrink-0", isActive ? "text-[#7C3AED]" : "text-gray-400 group-hover:text-[#4F46E5]")}
                />
                <span
                  className={cn(
                    "truncate transition-all duration-300 ease-in-out motion-reduce:transition-none",
                    collapsed ? "w-0 overflow-hidden opacity-0" : "opacity-100",
                  )}
                >
                  {item.title}
                </span>
              </Link>
            </div>
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

      {/* Footer */}
      <div className="mt-auto shrink-0 px-4 pt-4">
        <div
          className={cn(
            "bg-gray-50 border border-gray-100 rounded-2xl p-3 flex items-center gap-3",
            collapsed ? "flex-col justify-center" : "justify-between",
          )}
        >
          <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "flex-col")}>
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {initial}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div
              className={cn(
                "flex flex-col truncate transition-all duration-300 ease-in-out motion-reduce:transition-none",
                collapsed ? "hidden h-0 w-0 opacity-0" : "opacity-100",
              )}
            >
              <span className="text-xs font-semibold text-gray-900 truncate">{user?.name}</span>
              <span className="text-[10px] text-gray-500 truncate">{user?.email}</span>
            </div>
          </div>

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                >
                  <LogOut className="h-5 w-5" />
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
              title="Sign out"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  return <TooltipProvider delayDuration={200}>{rail}</TooltipProvider>;
}
