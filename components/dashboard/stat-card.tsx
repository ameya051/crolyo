import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  live?: boolean;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, hint, live, icon }: StatCardProps) {
  return (
    <Card className="rounded-none border-0 [--card-spacing:1.5rem]">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        {icon ? <CardAction>{icon}</CardAction> : null}
        <CardTitle className="font-mono text-2xl font-normal tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {live ? (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-slack-green opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-slack-green" />
              </span>
            ) : null}
            <span>{hint}</span>
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
