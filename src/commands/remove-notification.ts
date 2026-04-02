import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';

export const data = new SlashCommandBuilder()
  .setName('remove-notification')
  .setDescription('Unsubscribe this channel from vending machine notifications for a city')
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
    const results = await prisma.notification.findMany({
      where: {
        channelId: interaction.channelId,
        state: { contains: focused.value },
      },
      select: { state: true },
      distinct: ['state'],
      orderBy: { state: 'asc' },
      take: 25,
    });
    await interaction.respond(results.map((r) => ({ name: r.state, value: r.state })));
  } else {
    const state = interaction.options.getString('state');
    const results = await prisma.notification.findMany({
      where: {
        channelId: interaction.channelId,
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

  const deleted = await prisma.notification.deleteMany({
    where: {
      channelId: interaction.channelId,
      city,
      state,
    },
  });

  if (deleted.count === 0) {
    await interaction.editReply(
      `This channel has no notification subscription for **${city}, ${state}**.`,
    );
    return;
  }

  await interaction.editReply(
    `This channel will no longer receive notifications for **${city}, ${state}**.`,
  );
}

export default { data, execute, autocomplete } satisfies Command;
