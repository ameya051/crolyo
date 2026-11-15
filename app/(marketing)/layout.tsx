export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    /* The single ruled column every marketing section hangs off. */
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col border-x border-border">{children}</div>
  );
}
