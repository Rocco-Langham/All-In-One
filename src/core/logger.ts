type Level = 'info' | 'warn' | 'error' | 'debug';

function log(level: Level, message: string, ...extra: unknown[]) {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(line, ...extra);
}

export const logger = {
  info: (msg: string, ...extra: unknown[]) => log('info', msg, ...extra),
  warn: (msg: string, ...extra: unknown[]) => log('warn', msg, ...extra),
  error: (msg: string, ...extra: unknown[]) => log('error', msg, ...extra),
  debug: (msg: string, ...extra: unknown[]) => {
    if (process.env.DEBUG) log('debug', msg, ...extra);
  },
};
