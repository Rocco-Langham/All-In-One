import type {
  ActionRowBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ClientEvents,
  ContainerBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  SharedSlashCommand,
} from 'discord.js';

export interface Command {
  data: SharedSlashCommand;
  execute(interaction: ChatInputCommandInteraction): Promise<unknown>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<unknown>;
}

export interface EventHandler<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute(...args: ClientEvents[K]): Promise<unknown> | unknown;
}

/** A button or menu click, or a popup form being submitted. */
export type PanelInteraction = MessageComponentInteraction | ModalSubmitInteraction;

/** Handles buttons, menus and popup forms whose custom id starts with `prefix`. */
export interface ComponentHandler {
  prefix: string;
  execute(interaction: PanelInteraction): Promise<unknown>;
}

/** What a page of the /config menu shows, using Discord's container layout. */
export interface ConfigView {
  components: (ContainerBuilder | ActionRowBuilder<MessageActionRowComponentBuilder>)[];
}

/** A page in the /config menu. */
export interface ConfigSection {
  /** Used in custom ids as `config:<id>:<action>`. Lowercase, no colons, not "open" or "home". */
  id: string;
  label: string;
  description: string;
  emoji?: string;
  /** Show this page as an icon-only button in the top-right of /config instead of in the row. */
  cornerIcon?: string;
  render(guildId: string): Promise<ConfigView>;
  /** Handles this page's own buttons and menus. `action` is the custom id after `config:<id>:`. */
  handle?(interaction: PanelInteraction, action: string, guildId: string): Promise<unknown>;
}

export interface BotModule {
  /** Stable id used in the database and in /config. Lowercase, no spaces. */
  id: string;
  name: string;
  description: string;
  /** Core modules can't be switched off. */
  toggleable: boolean;
  /** Whether the module is on in a server that hasn't configured it. */
  enabledByDefault: boolean;
  commands: Command[];
  events: EventHandler[];
  components?: ComponentHandler[];
  /** Pages this module adds to the /config menu. */
  configSections?: ConfigSection[];
}

/** Keeps an event's name and handler arguments in sync while storing it in a module. */
export function defineEvent<K extends keyof ClientEvents>(handler: EventHandler<K>): EventHandler {
  return handler as unknown as EventHandler;
}
