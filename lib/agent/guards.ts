/**
 * Fast, deterministic detection of explicit requests for a human. A match
 * escalates without calling the model. Paraphrases, other languages and
 * risk judgment are left to the model (it can also return
 * `visitor_requested`), so these patterns stay deliberately narrow: an
 * informational question like "what's your refund policy?" must never match.
 */

const HUMAN_TARGET =
  "(?:a\\s+|an\\s+|the\\s+|your\\s+|some\\s+)?(?:real\\s+|actual\\s+|live\\s+)?" +
  "(?:human|person|someone|somebody|agent|representative|rep|operator|staff|support\\s+team|support\\s+agent|team\\s+member|customer\\s+(?:service|support))";

const PATTERNS: RegExp[] = [
  // "connect me to a human", "can I talk to someone", "transfer me to an agent"
  new RegExp(
    `\\b(?:talk|speak|chat|connect|transfer|put|get)\\b(?:\\s+me)?(?:\\s+(?:through\\s+to|to|with|through))\\s+${HUMAN_TARGET}\\b`,
    "i"
  ),
  // "I want a human", "I need a real person", "I'd like a live agent"
  new RegExp(
    "\\b(?:want|need|like|request|prefer)\\b(?:\\s+to\\s+(?:talk|speak|chat)\\s+(?:to|with))?\\s+(?:a\\s+|an\\s+)?(?:real\\s+|actual\\s+|live\\s+)?(?:human|real\\s+person|live\\s+(?:agent|person|chat)|representative)\\b",
    "i"
  ),
  // "real person please", "a live agent"
  /\b(?:real|actual|live)\s+(?:human|person|agent)\b/i,
  // the whole message is just "human" / "agent" / "representative"
  /^\s*(?:human|agent|representative|operator|real person)(?:\s+please)?[\s!.?]*$/i,
];

export function detectHumanRequest(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return PATTERNS.some((pattern) => pattern.test(normalized));
}
