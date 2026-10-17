# All In One

One Discord bot that replaces the rest. Built with TypeScript and discord.js v14.

## Setup

1. Create an application at <https://discord.com/developers/applications>, add a bot, and copy its **token** and the app's **client ID**.
2. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`. Set `DEV_GUILD_ID` to your test server's ID so commands show up instantly.
3. Install and set up the database:

   ```bash
   npm install
   npm run db:push
   ```

4. Register the slash commands, then start the bot:

   ```bash
   npm run deploy-commands
   npm run dev
   ```

Invite the bot with the `bot` and `applications.commands` scopes (OAuth2 → URL Generator in the developer portal).

## Scripts

| Script                        | What it does                                           |
| ----------------------------- | ------------------------------------------------------ |
| `npm run dev`                 | Run with auto-reload while developing                  |
| `npm run build` / `start`     | Compile to `dist/` and run the compiled bot            |
| `npm run deploy-commands`     | Register slash commands in every server                |
| `npm run deploy-commands:dev` | Register only in `DEV_GUILD_ID` (instant, for testing) |
| `npm run db:push`             | Apply `prisma/schema.prisma` to the database           |
| `npm run typecheck`           | Type-check without building                            |
| `npm run lint` / `format`     | ESLint / Prettier                                      |

## How it's organised

Every feature area is a **module** in `src/modules/<name>/` with its own commands and events. Server admins switch modules on or off in `/config` → Modules; the `core` module is always on.

To add a module:

1. Create `src/modules/<name>/index.ts` exporting a `BotModule` (see `src/core/types.ts`).
2. Add it to the list in `src/modules/index.ts`.
3. Run `npm run deploy-commands` again so Discord sees the new commands.

## Commands

| Command                    | What it does                                                                |
| -------------------------- | --------------------------------------------------------------------------- |
| `/config`                  | Settings menu: modules, warnings, welcome, sticky messages, theme, nickname |
| `/warn` / `/unwarn`        | Give or remove a warning; each warning number has its own timeout           |
| `/warnings` `/allwarnings` | One member's warnings, or every warning in the server                       |
| `/announce`                | Post an embed announcement, with an optional hidden ping                    |
| `/invitetrack`             | Invite leaderboard, or one member's invites                                 |
| `/help` / `/ping`          | List commands / check the bot is responding                                 |

## Discord setup

- **Privileged intent:** turn on **Server Members Intent** in the Developer Portal → Bot.
- **Bot permissions:** Timeout Members (warnings), Manage Roles (auto roles), Manage Server (invite tracking), Change Nickname, and Send Messages / Embed Links / Attach Files in the channels it posts in.

## Version

The version shown in `/config` comes from `"version"` in `package.json`.
