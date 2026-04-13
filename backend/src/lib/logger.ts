export interface Logger {
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: unknown;
}

function createReplacer() {
  const seen = new WeakSet();

  return (_key: string, value: unknown) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
        code: (value as NodeJS.ErrnoException).code,
      };
    }

    if (typeof value === "bigint") {
      return value.toString();
    }

    if (value && typeof value === "object") {
      if (seen.has(value)) {
        return "[Circular]";
      }

      seen.add(value);
    }

    return value;
  };
}

function safeStringify(entry: LogEntry): string {
  try {
    return JSON.stringify(entry, createReplacer());
  } catch (error) {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: "error",
      message: "Failed to serialize log entry.",
      context: {
        originalLevel: entry.level,
        originalMessage: entry.message,
        serializationError: (error as Error).message,
      },
    });
  }
}

function write(level: string, message: string, context?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context !== undefined) {
    entry.context = context;
  }

  const line = safeStringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger({ silent = false }: { silent?: boolean } = {}): Logger {
  if (silent) {
    const noop = () => {};
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  return {
    debug(message, context) {
      write("debug", message, context);
    },
    info(message, context) {
      write("info", message, context);
    },
    warn(message, context) {
      write("warn", message, context);
    },
    error(message, context) {
      write("error", message, context);
    },
  };
}
