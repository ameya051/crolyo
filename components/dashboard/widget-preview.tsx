import { MessageCircleIcon, SendIcon } from "lucide-react";

interface WidgetPreviewProps {
  primaryColor: string;
  welcomeMessage: string;
  siteName: string;
}

export function WidgetPreview({ primaryColor, welcomeMessage, siteName }: WidgetPreviewProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-b from-muted/40 to-muted/10 p-5">
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="size-2 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 text-xs text-muted-foreground">{siteName}</span>
      </div>

      <div className="relative mt-4 h-64 rounded-lg border border-border bg-background/60">
        <div className="absolute bottom-4 right-4 w-60 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: primaryColor }}>
            <span className="flex size-7 items-center justify-center rounded-full bg-white/20">
              <MessageCircleIcon className="size-4 text-white" />
            </span>
            <div className="leading-tight">
              <p className="text-xs font-semibold text-white">{siteName}</p>
              <p className="text-[10px] text-white/80">Typically replies in a few minutes</p>
            </div>
          </div>
          <div className="space-y-2 p-3">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-xs text-foreground">
              {welcomeMessage}
            </div>
            <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-sm px-3 py-2 text-xs text-white" style={{ backgroundColor: primaryColor }}>
              Hi! Quick question about pricing.
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <span className="flex-1 text-xs text-muted-foreground">Type a message…</span>
            <span className="flex size-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: primaryColor }}>
              <SendIcon className="size-3" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
