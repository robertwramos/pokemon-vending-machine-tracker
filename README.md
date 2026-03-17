# Pokemon Vending Machine Bot

A Discord bot for tracking Pokemon TCG vending machines — monitor stock status, log check-ins, and record restocks across your server.

## Features

- Post live vending machine status cards to any channel
- Check in to report what products are available (or out of stock)
- Mark machines as Snorlaxed or restocked
- View check-in history for the past two weeks
- Retroactively add past check-ins with timezone-aware datetime input
- Set cross street landmarks for easier machine identification

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A Discord application and bot token ([Discord Developer Portal](https://discord.com/developers/applications))

## Installation

**1. Clone the repository and install dependencies**

```bash
git clone <repo-url>
cd discord_vending_machine_bot
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Then edit `.env` and fill in the values:

| Variable        | Description                                                                |
| --------------- | -------------------------------------------------------------------------- |
| `DISCORD_TOKEN` | Your bot token from the Discord Developer Portal                           |
| `CLIENT_ID`     | Your application's client ID                                               |
| `GUILD_ID`      | _(Optional)_ A single guild ID for instant command registration during dev |
| `DATABASE_URL`  | MySQL connection URL (e.g. `mysql://user:pass@localhost:3306/dbname`)      |

> Omitting `GUILD_ID` will register commands globally (can take up to 1 hour to propagate).

**3. Set up the database**

```bash
npm run db:push
```

**4. Register slash commands with Discord**

```bash
npm run deploy:commands
```

**5. Start the bot**

```bash
# Development (ts-node, no compile step)
npm run dev

# Production (full bootstrap: install, build, migrate, seed, deploy commands, then run)
npm start
```

## Commands

| Command              | Permission      | Description                                                |
| -------------------- | --------------- | ---------------------------------------------------------- |
| `/deploy-machines`   | Manage Channels | Post all machines from a city/state to the current channel |
| `/deploy-by-zipcode` | Manage Channels | Post all machines for a zip code to the current channel    |
| `/remove-machine`    | Manage Channels | Remove a specific machine post from the current channel    |
| `/remove-machines`   | Manage Channels | Remove all machine posts from the current channel          |
| `/set-cross-streets` | Manage Channels | Set cross street landmarks for a machine                   |
| `/add-past-check-in` | Everyone        | Retroactively log a check-in with a past date and time     |

### Machine card buttons

Each posted machine card has four buttons:

| Button         | Description                                          |
| -------------- | ---------------------------------------------------- |
| **Check In**   | Opens a product selection modal to log current stock |
| **Snorlaxed**  | Marks the machine as Snorlaxed (empty/locked)        |
| **Restocked**  | Reports that the machine has been restocked          |
| **Check Logs** | DMs you the check-in history for the past two weeks  |

## Development

```bash
# Run tests
npm test

# Lint
npm run lint

# Format
npm run format

# Open Prisma Studio (database GUI)
npm run db:studio
```
