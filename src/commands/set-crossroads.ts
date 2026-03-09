import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';
import { buildMachineMessage } from '../utils/machineEmbed';

export const data = new SlashCommandBuilder()
  .setName('set-crossroads')
  .setDescription('Set the cross streets for a vending machine')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName('machine_id')
      .setDescription('Machine ID')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName('crossroads')
      .setDescription('Cross streets (e.g. "Main St & Oak Ave")')
      .setRequired(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const results = await prisma.vendingMachine.findMany({
    where: {
      OR: [{ machineId: { contains: focused } }, { store: { contains: focused } }],
    },
    select: { machineId: true, store: true },
    orderBy: { machineId: 'asc' },
    take: 25,
  });
  await interaction.respond(
    results.map((r) => ({ name: `${r.machineId} — ${r.store}`, value: r.machineId })),
  );
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const machineId = interaction.options.getString('machine_id', true);
  const crossroads = interaction.options.getString('crossroads', true);

  const machine = await prisma.vendingMachine.findUnique({ where: { machineId } });

  if (!machine) {
    await interaction.editReply(`No machine found with ID \`${machineId}\`.`);
    return;
  }

  const updatedMachine = await prisma.vendingMachine.update({
    where: { machineId },
    data: { crossStreets: crossroads },
  });

  const machineMessages = await prisma.machineMessage.findMany({
    where: { vendingMachineId: updatedMachine.id },
  });

  for (const record of machineMessages) {
    try {
      const channel = await interaction.client.channels.fetch(record.channelId);
      if (channel?.isTextBased()) {
        const msg = await (channel as TextChannel).messages.fetch(record.messageId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await msg.edit(buildMachineMessage(updatedMachine) as any);
      }
    } catch {
      // Message or channel no longer exists — skip
    }
  }

  await interaction.editReply(
    `Updated cross streets for \`${machineId}\` to: **${crossroads}**`,
  );
}

export default { data, execute, autocomplete } satisfies Command;
