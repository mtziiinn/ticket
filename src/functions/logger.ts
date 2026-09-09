type LogLevel = "info" | "warn" | "error" | "debug";

const COLORS: Record<LogLevel, string> = {
  info: "\x1b[36m",    // cyan
  warn: "\x1b[33m",    // yellow
  error: "\x1b[31m",   // red
  debug: "\x1b[90m",   // gray
};
const RESET = "\x1b[0m";

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function format(level: LogLevel, tag: string, message: string): string {
  return `${COLORS[level]}[${timestamp()}] [${tag}]${RESET} ${message}`;
}

export const log = {
  info(tag: string, message: string) {
    console.log(format("info", tag, message));
  },
  warn(tag: string, message: string) {
    console.warn(format("warn", tag, message));
  },
  error(tag: string, message: string, err?: any) {
    const suffix = err?.message ? ` — ${err.message}` : "";
    console.error(format("error", tag, message + suffix));
  },
  debug(tag: string, message: string) {
    if (process.env.NODE_ENV === "development") {
      console.log(format("debug", tag, message));
    }
  },
};