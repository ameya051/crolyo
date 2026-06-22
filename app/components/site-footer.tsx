import Link from "next/link";
import { ModeToggle } from "@/components/ui/mode-toggle";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-surface/30">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            &copy; {new Date().getFullYear()}
            <a
              href="https://ameyashr.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium hover:text-brand transition-colors decoration-border underline-offset-4"
            >
              Ameya
            </a>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/llms.txt" className="hover:text-foreground transition-colors">llms.txt</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/trust" className="hover:text-foreground transition-colors">Trust Centre</Link>
            </nav>
            <div className="w-px h-4 bg-border hidden sm:block" />
            <ModeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
