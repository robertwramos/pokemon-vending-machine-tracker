import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { Command } from '../types';

export class BotClient extends Client {
  commands: Collection<string, Command> = new Collection();

  constructor() {
    super({
      intents: [GatewayIntentBits.Guilds],
    });
  }
}
