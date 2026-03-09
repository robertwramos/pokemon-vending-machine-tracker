import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';
import { buildMachineMessage } from '../utils/machineEmbed';

export const data = new SlashCommandBuilder()
  .setName('deploy-machines')
  .setDescription('Post all vending machines in a city to this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption((option) =>
    option
      .setName('state')
      .setDescription('State abbreviation (e.g. AZ)')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option.setName('city').setDescription('City name').setRequired(true).setAutocomplete(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === 'state') {
    const results = await prisma.vendingMachine.findMany({
      where: { state: { contains: focused.value } },
      select: { state: true },
      distinct: ['state'],
      orderBy: { state: 'asc' },
      take: 25,
    });
    await interaction.respond(results.map((r) => ({ name: r.state, value: r.state })));
  } else {
    const state = interaction.options.getString('state');
    const results = await prisma.vendingMachine.findMany({
      where: {
        city: { contains: focused.value },
        ...(state ? { state } : {}),
      },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
      take: 25,
    });
    await interaction.respond(results.map((r) => ({ name: r.city, value: r.city })));
  }
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const city = interaction.options.getString('city', true);
  const state = interaction.options.getString('state', true);
  const channel = interaction.channel as GuildTextBasedChannel | null;

  if (!channel) {
    await interaction.editReply('This command can only be used in a server text channel.');
    return;
  }

  const machines = await prisma.vendingMachine.findMany({
    where: { city, state },
    orderBy: { store: 'asc' },
  });

  if (machines.length === 0) {
    await interaction.editReply(`No vending machines found in ${city}, ${state}.`);
    return;
  }

  const existing = await prisma.machineMessage.findMany({
    where: {
      channelId: interaction.channelId,
      vendingMachineId: { in: machines.map((m) => m.id) },
    },
    select: { vendingMachineId: true },
  });

  const existingIds = new Set(existing.map((e) => e.vendingMachineId));
  const toAdd = machines.filter((m) => !existingIds.has(m.id));

  if (toAdd.length === 0) {
    await interaction.editReply(
      `All ${machines.length} machine${machines.length !== 1 ? 's' : ''} in ${city}, ${state} are already posted in this channel.`,
    );
    return;
  }

  let added = 0;
  for (const machine of toAdd) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = await channel.send(buildMachineMessage(machine) as any);

    await prisma.machineMessage.create({
      data: {
        vendingMachineId: machine.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId!,
        messageId: message.id,
      },
    });

    added++;
  }

  const skipped = machines.length - toAdd.length;
  let reply = `Deployed **${added}** machine${added !== 1 ? 's' : ''} from ${city}, ${state}`;
  if (skipped > 0) reply += ` (skipped **${skipped}** already in channel)`;

  await interaction.editReply(reply + '.');
}

export default { data, execute, autocomplete } satisfies Command;
