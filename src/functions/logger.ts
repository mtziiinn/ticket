import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type LogLevel = "info" | "warn" | "error" | "debug";

const COLORS: Record<LogLevel, string> = {
  info: "\x1b[36m",    // cyan
  warn: "\x1b[33m",    // yellow
  error: "\x1b[31m",   // red
  debug: "\x1b[90m",   // gray
};
const RESET = "\x1b[0m";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "bot.log");
const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2MB antes de rotacionar

try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch {}

function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function fullTimestamp(): string {
  return new Date().toISOString();
}

function format(level: LogLevel, tag: string, message: string): string {
  return `${COLORS[level]}[${timestamp()}] [${tag}]${RESET} ${message}`;
}

function writeFile(level: LogLevel, tag: string, message: string): void {
  try {
    // Rotação simples: se o arquivo passar de MAX_LOG_BYTES, renomeia para .old
    try {
      const { statSync, renameSync } = require("node:fs") as typeof import("node:fs");
      const st = statSync(LOG_FILE);
      if (st.size > MAX_LOG_BYTES) {
        renameSync(LOG_FILE, `${LOG_FILE}.old`);
      }
    } catch {}
    appendFileSync(LOG_FILE, `${fullTimestamp()} [${level.toUpperCase()}] [${tag}] ${message}\n`);
  } catch {}
}

export const log = {
  info(tag: string, message: string) {
    console.log(format("info", tag, message));
    writeFile("info", tag, message);
  },
  warn(tag: string, message: string) {
    console.warn(format("warn", tag, message));
    writeFile("warn", tag, message);
  },
  error(tag: string, message: string, err?: any) {
    const suffix = err?.message ? ` — ${err.message}` : "";
    console.error(format("error", tag, message + suffix));
    const stack = err?.stack ? `\n${err.stack}` : "";
    writeFile("error", tag, message + suffix + stack);
  },
  debug(tag: string, message: string) {
    if (process.env.NODE_ENV === "development") {
      console.log(format("debug", tag, message));
      writeFile("debug", tag, message);
    }
  },
};