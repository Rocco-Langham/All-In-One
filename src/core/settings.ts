import { db } from './db.js';
import { getModule } from './registry.js';

export async function isModuleEnabled(guildId: string, moduleId: string): Promise<boolean> {
  const mod = getModule(moduleId);
  if (!mod) return false;
  if (!mod.toggleable) return true;

  const row = await db.guildModule.findUnique({
    where: { guildId_module: { guildId, module: moduleId } },
  });
  return row?.enabled ?? mod.enabledByDefault;
}

export async function setModuleEnabled(guildId: string, moduleId: string, enabled: boolean) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await db.guildModule.upsert({
    where: { guildId_module: { guildId, module: moduleId } },
    create: { guildId, module: moduleId, enabled },
    update: { enabled },
  });
}
