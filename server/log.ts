// The server's log (docs/RELIABILITY.md#logging): one JSON line per event on stdout, at or above LOG_LEVEL.
// Fields never carry session tokens, clip tokens, player names, request bodies or query strings.
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export type LogFields = Record<string, string | number | boolean>;
export type Logger = Record<LogLevel, (event: string, fields?: LogFields) => void>;

export function createLogger(
  minimum: LogLevel,
  write: (line: string) => void = (line) => console.log(line),
  now: () => Date = () => new Date(),
): Logger {
  const at =
    (level: LogLevel) =>
    (event: string, fields: LogFields = {}) => {
      if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(minimum)) return;
      write(JSON.stringify({ time: now().toISOString(), level, event, ...fields }));
    };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
