import type { BotModule } from '../core/types.js';
import { announceModule } from './announce/index.js';
import { coreModule } from './core/index.js';
import { invitesModule } from './invites/index.js';
import { moderationModule } from './moderation/index.js';
import { stickyModule } from './sticky/index.js';
import { warningsModule } from './warnings/index.js';
import { welcomeModule } from './welcome/index.js';

/** Every module the bot ships with. Add new modules here. */
export const modules: BotModule[] = [
  coreModule,
  warningsModule,
  moderationModule,
  welcomeModule,
  stickyModule,
  announceModule,
  invitesModule,
];
