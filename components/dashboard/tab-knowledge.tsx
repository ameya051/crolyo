import { BookOpenIcon } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";

// The knowledge base UI lives in components/dashboard/knowledge/ and is not
// rendered until the feature launches.
export function TabKnowledge() {
  return (
    <EmptyState
      icon={<BookOpenIcon className="size-5" />}
      title="Knowledge base — coming soon"
      description="Add your docs and FAQs, and an optional AI agent will answer visitor questions from them, handing off to Slack when it's unsure. Off unless you opt in."
    />
  );
}
