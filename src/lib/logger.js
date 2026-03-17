function write(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export function createLogger({ silent = false } = {}) {
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
