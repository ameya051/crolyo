"use client";

type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|content|message|email)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message.slice(0, 500) };
  if (typeof value === "string") return value.slice(0, 500);
  if (typeof value !== "object" || value === null) return value;
  if (depth >= 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      isSensitiveKey(key.toLowerCase()) ? "[redacted]" : sanitize(item, depth + 1),
    ])
  );
}

function isSensitiveKey(key: string): boolean {
  return key === "code" || key === "state" || SENSITIVE_KEY.test(key);
}

function write(level: LogLevel, event: string, context: LogContext = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(sanitize(context) as LogContext),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const clientLogger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, error?: unknown, context?: LogContext) =>
    write("error", event, { ...context, ...(error === undefined ? {} : { error: sanitize(error) }) }),
};
