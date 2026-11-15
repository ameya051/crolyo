import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-14 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-brand/10 text-brand">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-medium tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
