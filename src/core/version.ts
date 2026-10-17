import { readFileSync } from 'node:fs';

// package.json sits two folders up from both src/core and dist/core.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** The bot's version, taken from package.json. */
export const BOT_VERSION: string = pkg.version;
