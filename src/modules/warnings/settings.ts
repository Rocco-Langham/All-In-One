import { db } from '../../core/db.js';

export interface WarnSettings {
  logChannelId: string | null;
  /** Where the alert goes. Null = the log channel. */
  alertChannelId: string | null;
  alertLevel: number | null;
  alertMessage: string | null;
}

export const DEFAULT_ALERT_MESSAGE = '🚨 {user} has reached **Warning {warning}**.';

export async function getWarnSettings(guildId: string): Promise<WarnSettings> {
  const row = await db.warningSettings.findUnique({ where: { guildId } });
  return {
    logChannelId: row?.logChannelId ?? null,
    alertChannelId: row?.alertChannelId ?? null,
    alertLevel: row?.alertLevel ?? null,
    alertMessage: row?.alertMessage ?? null,
  };
}

export async function updateWarnSettings(guildId: string, changes: Partial<WarnSettings>) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.warningSettings.upsert({
    where: { guildId },
    create: { guildId, ...changes },
    update: changes,
  });
}
