import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/**
 * Page title block for dashboard pages. The negative margins cancel the
 * padding of <main> in DashboardShell so the bottom rule spans the full
 * ruled column; it must be the first child of a page rendered directly in it.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="-mx-4 -mt-8 flex flex-col gap-3 border-b border-border px-4 py-6 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-light tracking-[-0.02em] text-foreground">{title}</h1>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
