const features = [
  {
    title: "Widget",
    description: "One script tag adds a fast, lightweight chat widget to any site.",
  },
  {
    title: "Slack threads",
    description: "Each conversation is a thread in your channel. Reply there and the visitor sees it.",
  },
  {
    title: "AI agent",
    description: "Answers from your knowledge base and hands off to your team in Slack.",
  },
];

export default function FeatureStrip() {
  return (
    <ul className="grid grid-cols-1 border-y border-border sm:grid-cols-3">
      {features.map((feature) => (
        <li
          key={feature.title}
          className="flex flex-col gap-2 border-b border-border px-4 py-6 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:last:border-r-0"
        >
          <p className="font-mono text-base font-medium text-foreground">{feature.title}</p>
          <p className="text-base leading-relaxed text-muted-foreground">{feature.description}</p>
        </li>
      ))}
    </ul>
  );
}
