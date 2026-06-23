import { cn } from "@/lib/utils";

type Tone = "success" | "muted" | "warning" | "brand";

interface StatusBadgeProps {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const toneClasses: Record<Tone, string> = {
  success: "bg-slack-green/10 text-slack-green dark:text-slack-green",
  muted: "bg-muted text-muted-foreground",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  brand: "bg-primary/10 text-primary",
};

const dotClasses: Record<Tone, string> = {
  success: "bg-slack-green",
  muted: "bg-muted-foreground/60",
  warning: "bg-amber-500 dark:bg-amber-400",
  brand: "bg-primary",
};

export function StatusBadge({ tone, children, dot, pulse, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      {dot ? (
        <span className="relative flex size-1.5">
          {pulse ? (
            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", dotClasses[tone])} />
          ) : null}
          <span className={cn("relative inline-flex size-1.5 rounded-full", dotClasses[tone])} />
        </span>
      ) : null}
      {children}
    </span>
  );
}
