import type { APIModalInteractionResponseCallbackData } from 'discord-api-types/v10';
import { ButtonInteraction, EmbedBuilder, ModalSubmitInteraction, TextChannel } from 'discord.js';
import prisma from '../lib/prisma';
import { buildMachineMessage } from '../utils/machineEmbed';
import { getMachineTimezone } from '../utils/timezone';

const PRODUCTS_CUSTOM_ID = 'checkin_products';

const PRODUCT_OPTIONS = [
  { label: 'Booster Pack', value: 'pack' },
  { label: 'Booster Bundle', value: 'bundle' },
  { label: 'Elite Trainer Box', value: 'etb' },
  { label: 'Booster Box', value: 'booster_box' },
  { label: 'Tin', value: 'tin' },
  { label: 'Out of Stock', value: 'out_of_stock' },
];

function buildCheckInModal(
  machineId: number,
  channelId: string,
  messageId: string,
  errorMessage?: string,
) {
  const components: object[] = [];

  if (errorMessage) {
    components.push({
      type: 10, // Text Display
      content: errorMessage,
    });
  }

  components.push({
    type: 18, // Label
    label: 'Select available products or Out of Stock',
    component: {
      type: 22, // CheckboxGroup
      custom_id: PRODUCTS_CUSTOM_ID,
      required: true,
      options: PRODUCT_OPTIONS,
    },
  });

  return {
    title: 'Check In',
    custom_id: `checkin_modal:${machineId}:${channelId}:${messageId}`,
    components,
  };
}

async function refreshMachineMessage(interaction: ButtonInteraction, machineId: number) {
  const machine = await prisma.vendingMachine.findUnique({ where: { id: machineId } });
  if (!machine) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await interaction.message.edit(buildMachineMessage(machine) as any);
}

export async function handleCheckIn(
  interaction: ButtonInteraction,
  machineId: number,
): Promise<void> {
  // Cast via APIModal — discord-api-types doesn't yet include CheckboxGroup (type 22)
  // but the raw payload is valid per the Discord API
  await interaction.showModal(
    buildCheckInModal(
      machineId,
      interaction.channelId,
      interaction.message.id,
    ) as unknown as APIModalInteractionResponseCallbackData,
  );
}

export async function handleCheckInModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const machineId = parseInt(parts[1], 10);
  const channelId = parts[2];
  const messageId = parts[3];

  const field = interaction.fields.getField(PRODUCTS_CUSTOM_ID) as unknown as {
    values?: string[];
  };
  const selectedValues: string[] = field?.values ?? [];

  const outOfStock = selectedValues.includes('out_of_stock');
  const productValues = selectedValues.filter((v) => v !== 'out_of_stock');

  // Out of Stock always wins; if both were selected, warn the user after saving.
  const conflictWarning = outOfStock && productValues.length > 0;
  const finalProductValues = outOfStock ? [] : productValues;

  const now = new Date();
  const username = interaction.user.username;
  const userId = interaction.user.id;

  await prisma.vendingMachine.update({
    where: { id: machineId },
    data: { status: 'Online', lastCheckedAt: now, lastCheckedBy: userId },
  });

  await prisma.machineCheckIn.create({
    data: {
      vendingMachineId: machineId,
      checkedAt: now,
      checkedBy: username,
      packAvailable: finalProductValues.includes('pack'),
      boosterBundleAvailable: finalProductValues.includes('bundle'),
      etbAvailable: finalProductValues.includes('etb'),
      boosterBoxAvailable: finalProductValues.includes('booster_box'),
      tinAvailable: finalProductValues.includes('tin'),
      outOfStock,
    },
  });

  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const machine = await prisma.vendingMachine.findUnique({ where: { id: machineId } });
      if (machine) {
        const msg = await (channel as TextChannel).messages.fetch(messageId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await msg.edit(buildMachineMessage(machine) as any);
      }
    }
  } catch (err) {
    console.error('Failed to refresh machine message after check-in modal submit:', err);
  }

  const replyContent = conflictWarning
    ? '⚠️ Your check-in was recorded as **Out of Stock** because you had both products and Out of Stock selected. If you meant to log product availability, please submit another check-in.'
    : outOfStock
      ? '📭 Checked in — machine marked **Out of Stock**.'
      : '✅ Checked in — machine marked **Online**.';

  await interaction.reply({ content: replyContent, ephemeral: true });
}

export async function handleSnorlaxed(
  interaction: ButtonInteraction,
  machineId: number,
): Promise<void> {
  const now = new Date();
  const userId = interaction.user.id;

  await prisma.vendingMachine.update({
    where: { id: machineId },
    data: { status: 'Snorlaxed', lastCheckedAt: now, lastCheckedBy: userId },
  });

  await refreshMachineMessage(interaction, machineId);
  await interaction.reply({ content: '😴 Machine marked **Snorlaxed**.', ephemeral: true });
}

export async function handleRestock(
  interaction: ButtonInteraction,
  machineId: number,
): Promise<void> {
  const now = new Date();
  const username = interaction.user.username;

  await prisma.vendingMachine.update({
    where: { id: machineId },
    data: { restockedAt: now },
  });

  await prisma.machineRestock.create({
    data: { vendingMachineId: machineId, restockedAt: now, reportedBy: username },
  });

  await refreshMachineMessage(interaction, machineId);
  await interaction.reply({ content: '📦 Restock reported — thanks!', ephemeral: true });
}


// Returns fixed-width "YYYY-MM-DD HH:MM AM" (19 chars) in the given timezone
function formatInTimezone(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const p: Record<string, string> = Object.fromEntries(
    fmt.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

const CHECK_IN_PRODUCT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'packAvailable', label: 'Pack' },
  { key: 'boosterBundleAvailable', label: 'Bundle' },
  { key: 'etbAvailable', label: 'ETB' },
  { key: 'boosterBoxAvailable', label: 'Booster Box' },
  { key: 'tinAvailable', label: 'Tin' },
];


export async function handleCheckLogs(
  interaction: ButtonInteraction,
  machineId: number,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const checkIns = await prisma.machineCheckIn.findMany({
    where: {
      vendingMachineId: machineId,
      checkedAt: { gte: twoWeeksAgo },
    },
    orderBy: { checkedAt: 'asc' },
  });

  if (checkIns.length === 0) {
    await interaction.editReply('No check-ins recorded for this machine in the past two weeks.');
    return;
  }

  const machine = await prisma.vendingMachine.findUnique({ where: { id: machineId } });
  const timezone = machine ? getMachineTimezone(machine) : 'UTC';

  // "YYYY-MM-DD HH:MM AM" = 19 chars, "Out of Stock" = 12 chars
  const DATE_W = 19;
  const STATUS_W = 12;
  const header = `${'Date'.padEnd(DATE_W)}  ${'Status'.padEnd(STATUS_W)}  Products`;
  const divider = `${'-'.repeat(DATE_W)}  ${'-'.repeat(STATUS_W)}  --------`;

  const rows = checkIns.map((c) => {
    const date = formatInTimezone(c.checkedAt, timezone).padEnd(DATE_W);
    const status = (c.outOfStock ? 'Out of Stock' : 'In Stock').padEnd(STATUS_W);
    const products = c.outOfStock
      ? '—'
      : CHECK_IN_PRODUCT_FIELDS.filter((f) => c[f.key as keyof typeof c] === true)
          .map((f) => f.label)
          .join(', ') || '—';
    return `${date}  ${status}  ${products}`;
  });

  const table = '```\n' + [header, divider, ...rows].join('\n') + '\n```';

  const embed = new EmbedBuilder()
    .setTitle('Check-in Logs — Last 2 Weeks')
    .setDescription(table)
    .setFooter({ text: machine ? `${machine.store} · ${machine.address} · ${timezone}` : `Machine #${machineId}` })
    .setColor(0x3b4cca);

  try {
    await interaction.user.send({ embeds: [embed] });
    await interaction.editReply('Check your DMs for the check-in logs!');
  } catch {
    await interaction.editReply(
      "Couldn't send you a DM. Please enable DMs from server members and try again.",
    );
  }
}

export async function handlePastCheckInModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const parts = interaction.customId.split(':');
  const machineId = parseInt(parts[1], 10);
  const checkedAt = new Date(parseInt(parts[2], 10));

  const field = interaction.fields.getField(PRODUCTS_CUSTOM_ID) as unknown as {
    values?: string[];
  };
  const selectedValues: string[] = field?.values ?? [];

  const outOfStock = selectedValues.includes('out_of_stock');
  const productValues = selectedValues.filter((v) => v !== 'out_of_stock');

  const conflictWarning = outOfStock && productValues.length > 0;
  const finalProductValues = outOfStock ? [] : productValues;

  const username = interaction.user.username;

  await prisma.machineCheckIn.create({
    data: {
      vendingMachineId: machineId,
      checkedAt,
      checkedBy: username,
      packAvailable: finalProductValues.includes('pack'),
      boosterBundleAvailable: finalProductValues.includes('bundle'),
      etbAvailable: finalProductValues.includes('etb'),
      boosterBoxAvailable: finalProductValues.includes('booster_box'),
      tinAvailable: finalProductValues.includes('tin'),
      outOfStock,
    },
  });

  const machine = await prisma.vendingMachine.findUnique({ where: { id: machineId } });
  const timezone = machine ? getMachineTimezone(machine) : 'UTC';
  const localTime = formatInTimezone(checkedAt, timezone);

  const replyContent = conflictWarning
    ? `⚠️ Past check-in recorded as **Out of Stock** at ${localTime} (${timezone}) — you had both products and Out of Stock selected.`
    : outOfStock
      ? `📭 Past check-in recorded — **Out of Stock** at ${localTime} (${timezone}).`
      : `✅ Past check-in recorded — **Online** at ${localTime} (${timezone}).`;

  await interaction.reply({ content: replyContent, ephemeral: true });
}
