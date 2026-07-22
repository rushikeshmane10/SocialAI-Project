import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

type PageHeaderContextValue = {
  title: string;
  setTitle: (title: string) => void;
  actions: ReactNode;
  setActions: (actions: ReactNode) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("Dashboard");
  const [actions, setActions] = useState<ReactNode>(null);

  const value = useMemo<PageHeaderContextValue>(
    () => ({ title, setTitle, actions, setActions }),
    [title, actions],
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  const context = useContext(PageHeaderContext);

  useEffect(() => {
    if (!context) return;

    context.setTitle(title);
    context.setActions(children ?? null);

    return () => {
      context.setTitle("Dashboard");
      context.setActions(null);
    };
  }, [context, title, children]);

  return null;
}

export function PageHeaderShell() {
  const context = useContext(PageHeaderContext);

  if (!context) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-12">
      <h1 className="font-heading text-[15px] font-bold tracking-tight">{context.title}</h1>
      <div className="flex items-center gap-2">
        {context.actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
