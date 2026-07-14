import { type ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-8 lg:px-12">
      <h1 className="font-heading text-[15px] font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2">
        {children}
        <ThemeToggle />
      </div>
    </header>
  );
}
