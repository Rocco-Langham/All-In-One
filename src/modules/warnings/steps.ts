import { db } from '../../core/db.js';

export interface WarningStep {
  level: number;
  timeoutMinutes: number;
}

/** Discord doesn't allow timeouts longer than 28 days. */
export const MAX_TIMEOUT_MINUTES = 28 * 24 * 60;
/** Keeps the config page within Discord's limit on components per message. */
export const MAX_STEPS = 10;

const DEFAULT_STEPS: WarningStep[] = [{ level: 1, timeoutMinutes: 30 }];

export async function getWarningSteps(guildId: string): Promise<WarningStep[]> {
  const rows = await db.warningStep.findMany({
    where: { guildId },
    orderBy: { level: 'asc' },
    select: { level: true, timeoutMinutes: true },
  });
  return rows.length > 0 ? rows : DEFAULT_STEPS;
}

/** The punishment for a member's nth warning. Past the last step, the last step repeats. */
export function stepForCount(steps: WarningStep[], count: number): WarningStep | undefined {
  return steps.find((s) => s.level === count) ?? steps.at(-1);
}

/** Saves the default ladder the first time a server changes it, so edits apply on top of it. */
async function ensureSaved(guildId: string) {
  await db.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  if ((await db.warningStep.count({ where: { guildId } })) === 0) {
    await db.warningStep.createMany({ data: DEFAULT_STEPS.map((s) => ({ guildId, ...s })) });
  }
}

export async function setStepTimeout(guildId: string, level: number, timeoutMinutes: number) {
  await ensureSaved(guildId);
  await db.warningStep.update({
    where: { guildId_level: { guildId, level } },
    data: { timeoutMinutes },
  });
}

/** Adds the next warning, starting at double the previous timeout. */
export async function addStep(guildId: string) {
  await ensureSaved(guildId);
  const steps = await getWarningSteps(guildId);
  const last = steps.at(-1);
  if (!last || steps.length >= MAX_STEPS) return;
  await db.warningStep.create({
    data: {
      guildId,
      level: last.level + 1,
      timeoutMinutes: Math.min(last.timeoutMinutes * 2, MAX_TIMEOUT_MINUTES),
    },
  });
}

/** Removes the highest warning. The first warning always stays. */
export async function removeLastStep(guildId: string) {
  await ensureSaved(guildId);
  const steps = await getWarningSteps(guildId);
  const last = steps.at(-1);
  if (!last || steps.length <= 1) return;
  await db.warningStep.delete({ where: { guildId_level: { guildId, level: last.level } } });
}
