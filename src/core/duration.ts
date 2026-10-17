const UNIT_MINUTES = { m: 1, h: 60, d: 60 * 24 } as const;

/**
 * Parses durations like "30m", "2h", "1d", "1h30m" or "1d 12h" into minutes.
 * A bare number counts as minutes. Returns null if the text isn't a duration.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(text)) return Number(text);
  if (!/^(\d+[mhd])+$/.test(text)) return null;

  let minutes = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+)([mhd])/g)) {
    minutes += Number(amount) * UNIT_MINUTES[unit as keyof typeof UNIT_MINUTES];
  }
  return minutes;
}

/** Formats minutes as "30m", "2h", "1h 30m", "3d 4h" and so on. */
export function formatDuration(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / UNIT_MINUTES.d);
  const hours = Math.floor((totalMinutes % UNIT_MINUTES.d) / UNIT_MINUTES.h);
  const minutes = totalMinutes % UNIT_MINUTES.h;
  const parts = [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(' ') : '0m';
}
