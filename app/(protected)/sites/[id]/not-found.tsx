import Link from "next/link";
import { CompassIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function SiteNotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CompassIcon className="size-6" />
      </div>
      <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        Site not found
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        This site may have been removed, or the link is incorrect.
      </p>
      <Link href="/overview" className={`${buttonVariants({ className: "mt-5 h-9 px-4" })}`}>
        Back to overview
      </Link>
    </div>
  );
}
