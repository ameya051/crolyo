type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEY = /(password|token|secret|authorization|cookie|content|message|plaintext|ciphertext|encryption|email)/i;
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 500;

function sanitizeString(value: string): string {
  return value
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .replace(/\b(?:xox[baprs]-|Bearer\s+)[A-Za-z0-9._-]+/gi, "[redacted-credential]")
    .slice(0, MAX_STRING_LENGTH);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: unknown };
    return {
      name: error.name,
      message: sanitizeString(error.message),
      ...(typeof withCode.code === "string" ? { code: sanitizeString(withCode.code) } : {}),
    };
  }

  if (typeof error === "object" && error !== null) {
    return sanitize(error, 0) as Record<string, unknown>;
  }

  return { value: sanitizeString(String(error)) };
}

function sanitize(value: unknown, depth: number): unknown {
  if (value instanceof Error) return serializeError(value);
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value !== "object" || value === null) return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
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
    ...(sanitize(context, 0) as LogContext),
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const logger = {
  info: (event: string, context?: LogContext) => write("info", event, context),
  warn: (event: string, context?: LogContext) => write("warn", event, context),
  error: (event: string, error?: unknown, context?: LogContext) =>
    write("error", event, { ...context, ...(error === undefined ? {} : { error: serializeError(error) }) }),
};
