import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('add-notification')
  .setDescription('Subscribe this channel to vending machine notifications for a city')
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

  const state = interaction.options.getString('state', true);
  const city = interaction.options.getString('city', true);

  const existing = await prisma.notification.findUnique({
    where: {
      channelId_city_state: {
        channelId: interaction.channelId,
        city,
        state,
      },
    },
  });

  if (existing) {
    await interaction.editReply(
      `This channel is already set up to receive notifications for **${city}, ${state}**.`,
    );
    return;
  }

  await prisma.notification.create({
    data: {
      channelId: interaction.channelId,
      guildId: interaction.guildId!,
      city,
      state,
    },
  });

  await interaction.editReply(
    `This channel will now receive notifications when a new vending machine is found in **${city}, ${state}**.`,
  );
}

export default { data, execute, autocomplete } satisfies Command;
