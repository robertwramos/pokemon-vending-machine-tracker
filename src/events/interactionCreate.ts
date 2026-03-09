import { Events, Interaction } from 'discord.js';
import { BotClient } from '../lib/client';
import {
  handleCheckIn,
  handleCheckInModalSubmit,
  handlePastCheckInModalSubmit,
  handleCheckLogs,
  handleSnorlaxed,
  handleRestock,
} from '../handlers/buttonHandlers';

export const name = Events.InteractionCreate;
export const once = false;

const BUTTON_HANDLERS: Record<
  string,
  (interaction: Parameters<typeof handleCheckIn>[0], machineId: number) => Promise<void>
> = {
  checkin: handleCheckIn,
  snorlaxed: handleSnorlaxed,
  restock: handleRestock,
  logs: handleCheckLogs,
};

export async function execute(interaction: Interaction, client: BotClient): Promise<void> {
  if (interaction.isButton()) {
    const [action, idStr] = interaction.customId.split(':');
    const handler = BUTTON_HANDLERS[action];
    if (!handler) return;

    try {
      await handler(interaction, parseInt(idStr, 10));
    } catch (error) {
      console.error(`Error handling button "${interaction.customId}":`, error);
      try {
        const reply = { content: 'Something went wrong.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const [modalType] = interaction.customId.split(':');
    const modalHandler =
      modalType === 'checkin_modal'
        ? handleCheckInModalSubmit
        : modalType === 'past_checkin_modal'
          ? handlePastCheckInModalSubmit
          : null;

    if (modalHandler) {
      try {
        await modalHandler(interaction);
      } catch (error) {
        console.error(`Error handling modal submit "${interaction.customId}":`, error);
        try {
          const reply = { content: 'Something went wrong.', ephemeral: true };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError);
        }
      }
    }
    return;
  }

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Error in command "${interaction.commandName}":`, error);
      try {
        const reply = {
          content: 'Something went wrong running that command.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Error in autocomplete for "${interaction.commandName}":`, error);
    }
  }
}
