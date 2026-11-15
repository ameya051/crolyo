const facts = [
  { value: "< 100 KB", label: "Widget payload" },
  { value: "1 tag", label: "To install on any site" },
  { value: "2 min", label: "From sign-up to first chat" },
  { value: "Real-time", label: "Between widget and Slack" },
];

export default function FactsRow() {
  return (
    <section className="my-10 grid grid-cols-2 border-y border-border md:my-20 md:grid-cols-4">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex flex-col justify-center gap-2 border-border px-4 py-6 text-center odd:border-r sm:px-6 md:border-r md:last:border-r-0 [&:nth-child(-n+2)]:border-b md:[&:nth-child(-n+2)]:border-b-0"
        >
          <p className="font-mono text-2xl text-foreground">{fact.value}</p>
          <p className="text-sm leading-5 text-muted-foreground">{fact.label}</p>
        </div>
      ))}
    </section>
  );
}
