import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('remove-machine')
  .setDescription('Remove a specific vending machine post from this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName('machine_id')
      .setDescription('Machine ID')
      .setRequired(true)
      .setAutocomplete(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  const messages = await prisma.machineMessage.findMany({
    where: { channelId: interaction.channelId },
    include: { vendingMachine: true },
  });

  const results = messages
    .filter(
      (m) =>
        m.vendingMachine.machineId.toLowerCase().includes(focused) ||
        m.vendingMachine.store.toLowerCase().includes(focused),
    )
    .slice(0, 25);

  await interaction.respond(
    results.map((m) => ({
      name: `${m.vendingMachine.machineId} — ${m.vendingMachine.store}`,
      value: m.vendingMachine.machineId,
    })),
  );
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const machineId = interaction.options.getString('machine_id', true);
  const channel = interaction.channel as GuildTextBasedChannel | null;

  if (!channel) {
    await interaction.editReply('This command can only be used in a server text channel.');
    return;
  }

  const machine = await prisma.vendingMachine.findUnique({ where: { machineId } });

  if (!machine) {
    await interaction.editReply(`No machine found with ID \`${machineId}\`.`);
    return;
  }

  const record = await prisma.machineMessage.findUnique({
    where: {
      vendingMachineId_channelId: {
        vendingMachineId: machine.id,
        channelId: interaction.channelId,
      },
    },
  });

  if (!record) {
    await interaction.editReply(`Machine \`${machineId}\` is not posted in this channel.`);
    return;
  }

  try {
    const message = await channel.messages.fetch(record.messageId);
    await message.delete();
  } catch {
    // Message already deleted manually
  }

  await prisma.machineMessage.delete({ where: { id: record.id } });
  await interaction.editReply(`Removed machine \`${machineId}\` from this channel.`);
}

export default { data, execute, autocomplete } satisfies Command;
