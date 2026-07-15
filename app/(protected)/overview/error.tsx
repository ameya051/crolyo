"use client";

import { useEffect } from "react";
import { RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/logger.client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLogger.error("ui.dashboard.error_boundary", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <RotateCcwIcon className="size-6" />
      </div>
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        Something went wrong
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t load this part of the dashboard. Try again — if it keeps happening, refresh the page.
      </p>
      <Button onClick={reset} className="mt-5 h-9 px-4">
        Try again
      </Button>
    </div>
  );
}
