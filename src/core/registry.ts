import { modules } from '../modules/index.js';
import type { BotModule, Command, ComponentHandler, ConfigSection } from './types.js';

const commandIndex = new Map<string, { command: Command; module: BotModule }>();

for (const mod of modules) {
  for (const command of mod.commands) {
    const name = command.data.name;
    const existing = commandIndex.get(name);
    if (existing) {
      throw new Error(
        `Command /${name} is defined in both "${existing.module.id}" and "${mod.id}".`,
      );
    }
    commandIndex.set(name, { command, module: mod });
  }
}

export function getModules(): readonly BotModule[] {
  return modules;
}

export function getModule(id: string): BotModule | undefined {
  return modules.find((m) => m.id === id);
}

export function findCommand(name: string) {
  return commandIndex.get(name);
}

export function allCommands(): Command[] {
  return modules.flatMap((m) => m.commands);
}

export function findComponentHandler(
  customId: string,
): { handler: ComponentHandler; module: BotModule } | undefined {
  for (const mod of modules) {
    const handler = mod.components?.find((h) => customId.startsWith(h.prefix));
    if (handler) return { handler, module: mod };
  }
  return undefined;
}

export function allConfigSections(): ConfigSection[] {
  return modules.flatMap((m) => m.configSections ?? []);
}

export function findConfigSection(id: string): ConfigSection | undefined {
  return allConfigSections().find((s) => s.id === id);
}
