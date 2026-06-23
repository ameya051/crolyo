import type { ReactNode } from "react";
import { SiteHeader } from "@/app/components/site-header";
import { SiteFooter } from "@/app/components/site-footer";

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

export function LegalPageLayout({
  eyebrow,
  title,
  subtitle,
  sections,
}: LegalPageLayoutProps) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-col">
        <section className="pt-28 sm:pt-36 pb-12 sm:pb-16 relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border border-border mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-slack-green animate-pulse" />
              <span className="text-xs font-medium text-muted-foreground tracking-wide">
                {eyebrow}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] max-w-3xl">
              {title}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
        </section>

        <section className="pb-24 sm:pb-32 relative">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <details className="lg:hidden group mb-10 rounded-2xl border border-border/60 bg-surface/40 overflow-hidden">
              <summary className="cursor-pointer list-none flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                <span>On this page</span>
                <svg
                  className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <nav className="px-5 pb-4 pt-1 border-t border-border/40">
                <ul className="space-y-1">
                  {sections.map((s, i) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="block py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span className="text-foreground/40 mr-2 font-mono text-xs">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {s.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>

            <div className="grid lg:grid-cols-[220px_1fr] lg:gap-16">
              <aside className="hidden lg:block">
                <div className="sticky top-32 self-start">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    On this page
                  </p>
                  <nav className="border-l border-border/60">
                    {sections.map((s, i) => (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        className="group block pl-4 py-2 -ml-px text-sm text-muted-foreground hover:text-foreground border-l border-transparent hover:border-brand transition-colors"
                      >
                        <span className="text-foreground/30 mr-2 font-mono text-xs group-hover:text-brand/70 transition-colors">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {s.title}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>

              <div className="space-y-16 max-w-3xl">
                {sections.map((s) => (
                  <section key={s.id} id={s.id} className="scroll-mt-32">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-5 text-foreground">
                      {s.title}
                    </h2>
                    <div className="space-y-4 text-base text-foreground/80 leading-relaxed [&_a]:text-brand [&_a]:underline-offset-4 [&_a:hover]:underline [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:list-decimal [&_li]:pl-1 [&_li::marker]:text-brand/60">
                      {s.content}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
