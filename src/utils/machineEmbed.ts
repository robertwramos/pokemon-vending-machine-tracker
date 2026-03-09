import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { VendingMachine } from '@prisma/client';
import { getRetailerLogo } from './retailers';

const STATUS_EMOJI: Record<string, string> = {
  Online: '🟢',
  Snorlaxed: '🔴',
  Restocking: '🔵',
  unknown: '⚪',
};

export function buildMachineEmbed(machine: VendingMachine): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setAuthor({ name: machine.store, iconURL: getRetailerLogo(machine.store) })
    .setDescription(`${machine.address}\n${machine.city}, ${machine.state} ${machine.zip}`)
    .setFooter({ text: machine.machineId })
    .setColor(0x3b4cca);

  const statusEmoji = STATUS_EMOJI[machine.status] ?? '⚪';
  embed.addFields({ name: 'Status', value: `${statusEmoji} ${machine.status}`, inline: true });

  if (machine.lastCheckedAt) {
    const ts = Math.floor(machine.lastCheckedAt.getTime() / 1000);
    embed.addFields({
      name: 'Last Checked',
      value: `<t:${ts}:f> by <@${machine.lastCheckedBy}>`,
      inline: true,
    });
  }

  if (machine.restockedAt) {
    const ts = Math.floor(machine.restockedAt.getTime() / 1000);
    embed.addFields({ name: 'Last Restocked', value: `<t:${ts}:f>`, inline: true });
  }

  return embed;
}

export function buildMachineMessage(machine: VendingMachine): Record<string, unknown> {
  const statusEmoji = STATUS_EMOJI[machine.status] ?? '⚪';
  const logoUrl = getRetailerLogo(machine.store);

  const headerText = [
    `## ${machine.crossStreets ?? machine.store}`,
    `${machine.address}`,
    `${machine.city}, ${machine.state} ${machine.zip}`,
    `*${machine.machineId}*`,
  ].join('\n');

  let statusText = `**Status**\n${statusEmoji} ${machine.status}`;
  if (machine.lastCheckedAt) {
    const ts = Math.floor(machine.lastCheckedAt.getTime() / 1000);
    statusText += `\n\n**Last Checked**\n<t:${ts}:f> by <@${machine.lastCheckedBy}>`;
  }
  if (machine.restockedAt) {
    const ts = Math.floor(machine.restockedAt.getTime() / 1000);
    statusText += `\n\n**Last Restocked**\n<t:${ts}:f>`;
  }

  return {
    flags: 1 << 15, // MessageFlags.IsComponentsV2
    embeds: [],
    components: [
      {
        type: 17, // Container
        accent_color: 0x3b4cca,
        components: [
          {
            type: 9, // Section
            components: [{ type: 10, content: headerText }],
            accessory: { type: 11, media: { url: logoUrl } },
          },
          { type: 14 }, // Separator
          { type: 10, content: statusText },
          buildMachineButtons(machine.id).toJSON(),
        ],
      },
    ],
  };
}

export function buildMachineButtons(machineId: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`checkin:${machineId}`)
      .setLabel('Check In')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`snorlaxed:${machineId}`)
      .setLabel('Snorlaxed')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`restock:${machineId}`)
      .setLabel('Restocked')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`logs:${machineId}`)
      .setLabel('Check Logs')
      .setStyle(ButtonStyle.Secondary),
  );
}
