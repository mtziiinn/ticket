const COLORS = {
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
    debug: "\x1b[90m", // gray
};
const RESET = "\x1b[0m";
function timestamp() {
    return new Date().toISOString().slice(11, 19);
}
function format(level, tag, message) {
    return `${COLORS[level]}[${timestamp()}] [${tag}]${RESET} ${message}`;
}
export const log = {
    info(tag, message) {
        console.log(format("info", tag, message));
    },
    warn(tag, message) {
        console.warn(format("warn", tag, message));
    },
    error(tag, message, err) {
        const suffix = err?.message ? ` — ${err.message}` : "";
        console.error(format("error", tag, message + suffix));
    },
    debug(tag, message) {
        if (process.env.NODE_ENV === "development") {
            console.log(format("debug", tag, message));
        }
    },
};
