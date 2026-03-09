import {
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('remove-machines')
  .setDescription('Remove all vending machine posts from this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.channel as GuildTextBasedChannel | null;

  if (!channel) {
    await interaction.editReply('This command can only be used in a server text channel.');
    return;
  }

  const machineMessages = await prisma.machineMessage.findMany({
    where: { channelId: interaction.channelId },
  });

  if (machineMessages.length === 0) {
    await interaction.editReply('No vending machine posts found in this channel.');
    return;
  }

  let removed = 0;
  let alreadyDeleted = 0;

  for (const record of machineMessages) {
    try {
      const message = await channel.messages.fetch(record.messageId);
      await message.delete();
      removed++;
    } catch {
      alreadyDeleted++;
    }
  }

  await prisma.machineMessage.deleteMany({
    where: { channelId: interaction.channelId },
  });

  let reply = `Removed **${removed}** machine post${removed !== 1 ? 's' : ''} from this channel.`;
  if (alreadyDeleted > 0) reply += ` (**${alreadyDeleted}** had already been deleted manually.)`;

  await interaction.editReply(reply);
}

export default { data, execute } satisfies Command;
