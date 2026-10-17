import { db } from './db.js';

/** Ready-made colour themes shown as buttons in /config → Settings. */
export const THEMES = [
  { id: 'blurple', label: 'Blurple', emoji: '🔵', color: 0x5865f2 },
  { id: 'red', label: 'Red', emoji: '🔴', color: 0xed4245 },
  { id: 'orange', label: 'Orange', emoji: '🟠', color: 0xf48c06 },
  { id: 'yellow', label: 'Yellow', emoji: '🟡', color: 0xfee75c },
  { id: 'green', label: 'Green', emoji: '🟢', color: 0x57f287 },
  { id: 'teal', label: 'Teal', emoji: '🩵', color: 0x1abc9c },
  { id: 'purple', label: 'Purple', emoji: '🟣', color: 0x9b59b6 },
  { id: 'pink', label: 'Pink', emoji: '🩷', color: 0xeb459e },
  { id: 'white', label: 'White', emoji: '⚪', color: 0xffffff },
  { id: 'black', label: 'Black', emoji: '⚫', color: 0x23272a },
] as const;

export const DEFAULT_THEME_COLOR = THEMES[0].color;

/**
 * Every server's theme, loaded once at startup so building a message never waits on the
 * database. Servers missing from here use the default.
 */
const themeColors = new Map<string, number>();

export async function loadThemes() {
  const rows = await db.guild.findMany({
    where: { themeColor: { not: null } },
    select: { id: true, themeColor: true },
  });
  themeColors.clear();
  for (const row of rows) if (row.themeColor !== null) themeColors.set(row.id, row.themeColor);
}

/** The colour for this server's menus and messages. */
export function themeColor(guildId: string | null | undefined): number {
  if (!guildId) return DEFAULT_THEME_COLOR;
  return themeColors.get(guildId) ?? DEFAULT_THEME_COLOR;
}

/** Saves a server's theme. Null goes back to the default. */
export async function setThemeColor(guildId: string, color: number | null) {
  await db.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, themeColor: color },
    update: { themeColor: color },
  });
  if (color === null) themeColors.delete(guildId);
  else themeColors.set(guildId, color);
}

export function hex(color: number) {
  return `#${color.toString(16).padStart(6, '0').toUpperCase()}`;
}

/** Parses "#5865F2", "5865f2" or "#58F" into a colour. Returns null if it isn't one. */
export function parseHex(input: string): number | null {
  let text = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) text = [...text].map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(text) ? parseInt(text, 16) : null;
}
