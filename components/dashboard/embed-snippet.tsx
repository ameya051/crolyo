"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function EmbedSnippet({ siteId }: { siteId: string }) {
  const [copied, setCopied] = useState(false);

  const snippet = `<script src="https://crolyo.ameyashr.in/widget.js" data-site-id="${siteId}" async defer></script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Snippet copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select and copy the snippet manually.");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40">
      <pre className="overflow-x-auto px-4 py-3.5 text-xs leading-relaxed text-foreground">
        <code>{snippet}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute right-2 top-2 h-7 gap-1.5 bg-background/80 backdrop-blur-sm"
      >
        {copied ? <CheckIcon className="size-3.5 text-slack-green" /> : <CopyIcon className="size-3.5" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}
