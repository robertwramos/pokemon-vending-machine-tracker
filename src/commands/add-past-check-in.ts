import type { APIModalInteractionResponseCallbackData } from 'discord-api-types/v10';
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import prisma from '../lib/prisma';
import { getMachineTimezone, parseInTimezone } from '../utils/timezone';

const PRODUCTS_CUSTOM_ID = 'checkin_products';

const PRODUCT_OPTIONS = [
  { label: 'Booster Pack', value: 'pack' },
  { label: 'Booster Bundle', value: 'bundle' },
  { label: 'Elite Trainer Box', value: 'etb' },
  { label: 'Booster Box', value: 'booster_box' },
  { label: 'Tin', value: 'tin' },
  { label: 'Out of Stock', value: 'out_of_stock' },
];

export const data = new SlashCommandBuilder()
  .setName('add-past-check-in')
  .setDescription('Retroactively add a check-in for a machine')
  .addStringOption((option) =>
    option
      .setName('machine_id')
      .setDescription('Machine ID')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName('datetime')
      .setDescription("Date and time in the machine's local timezone (YYYY-MM-DD HH:MM AM)")
      .setRequired(true),
  );

export async function autocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();
  const results = await prisma.vendingMachine.findMany({
    where: {
      AND: [
        { OR: [{ machineId: { contains: focused } }, { store: { contains: focused } }] },
        { machineMessages: { some: { channelId: interaction.channelId } } },
      ],
    },
    select: { machineId: true, store: true, crossStreets: true, address: true },
    orderBy: { machineId: 'asc' },
    take: 25,
  });
  await interaction.respond(
    results.map((r) => ({
      name: `${r.machineId} — ${r.store} — ${r.crossStreets ?? r.address}`,
      value: r.machineId,
    })),
  );
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const machineIdStr = interaction.options.getString('machine_id', true);
  const datetimeStr = interaction.options.getString('datetime', true);

  const machine = await prisma.vendingMachine.findUnique({ where: { machineId: machineIdStr } });
  if (!machine) {
    await interaction.reply({
      content: `No machine found with ID \`${machineIdStr}\`.`,
      ephemeral: true,
    });
    return;
  }

  const timezone = getMachineTimezone(machine);
  const utcDate = parseInTimezone(datetimeStr, timezone);

  if (!utcDate) {
    await interaction.reply({
      content:
        'Invalid datetime format. Please use `YYYY-MM-DD HH:MM AM` (e.g. `2024-06-01 10:30 AM`).',
      ephemeral: true,
    });
    return;
  }

  if (utcDate > new Date()) {
    await interaction.reply({
      content: 'The datetime cannot be in the future.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal({
    title: 'Past Check-In',
    custom_id: `past_checkin_modal:${machine.id}:${utcDate.getTime()}`,
    components: [
      {
        type: 18, // Label
        label: 'Select available products or Out of Stock',
        component: {
          type: 22, // CheckboxGroup
          custom_id: PRODUCTS_CUSTOM_ID,
          required: true,
          options: PRODUCT_OPTIONS,
        },
      },
    ],
  } as unknown as APIModalInteractionResponseCallbackData);
}

export default { data, execute, autocomplete } satisfies Command;
