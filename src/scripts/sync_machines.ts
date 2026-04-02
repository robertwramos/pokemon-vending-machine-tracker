/**
 * Nightly sync script — fetches Pokemon vending machine data from the API,
 * diffs against the DB, inserts any new machines found, and notifies
 * subscribed Discord channels.
 *
 * Only scans states that have at least one notification subscription,
 * keeping API calls to a minimum.
 *
 * Run via cron:
 *   0 2 * * * cd /path/to/bot && node dist/scripts/sync_machines.js >> logs/sync.log 2>&1
 */

import 'dotenv/config';
import { EmbedBuilder, REST, Routes } from 'discord.js';
import prisma from '../lib/prisma';
import { fetchMachines, type PokemonMachine } from '../utils/pokemonScraper';
import { STATE_BOUNDING_BOXES } from '../data/stateBoundingBoxes';
import { getRetailerLogo } from '../utils/retailers';

async function notifyChannels(rest: REST, machine: PokemonMachine): Promise<void> {
  const subscriptions = await prisma.notification.findMany({
    where: { city: machine.city, state: machine.stateProvince },
  });

  if (subscriptions.length === 0) return;

  console.log(
    `  Notifying ${subscriptions.length} channel(s) for ${machine.city}, ${machine.stateProvince}...`,
  );

  const embed = new EmbedBuilder()
    .setTitle('🆕 New Vending Machine Found!')
    .setColor(0x3b4cca)
    .setThumbnail(getRetailerLogo(machine.retailer))
    .addFields(
      { name: 'Store', value: machine.retailer, inline: true },
      { name: 'Machine ID', value: machine.name, inline: true },
      {
        name: 'Address',
        value: `${machine.street}\n${machine.city}, ${machine.stateProvince} ${machine.zipPostalCode}`,
      },
    )
    .setTimestamp();

  const body = { embeds: [embed.toJSON()] };

  for (const sub of subscriptions) {
    try {
      await rest.post(Routes.channelMessages(sub.channelId), { body });
      console.log(`    -> posted to channel ${sub.channelId}`);
    } catch (err) {
      console.error(`    -> failed to post to channel ${sub.channelId}: ${(err as Error).message}`);
    }
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting machine sync...`);

  if (!process.env.DISCORD_TOKEN) {
    console.error('DISCORD_TOKEN is not set.');
    process.exit(1);
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  // 1. Find states that have at least one notification subscription
  const rows = await prisma.notification.findMany({
    select: { state: true },
    distinct: ['state'],
    orderBy: { state: 'asc' },
  });

  const monitoredStates = rows.map((r) => r.state);

  if (monitoredStates.length === 0) {
    console.log('No notification subscriptions found — nothing to sync.');
    return;
  }

  console.log(`Monitored states (${monitoredStates.length}): ${monitoredStates.join(', ')}`);

  // 2. Resolve bounding boxes, warn on any unknown state codes
  const unknownStates = monitoredStates.filter((s) => !STATE_BOUNDING_BOXES[s]);
  if (unknownStates.length > 0) {
    console.warn(`No bounding box found for: ${unknownStates.join(', ')} — skipping.`);
  }

  const boxes = monitoredStates
    .filter((s) => STATE_BOUNDING_BOXES[s])
    .map((s) => STATE_BOUNDING_BOXES[s]);

  if (boxes.length === 0) {
    console.log('No valid bounding boxes — nothing to sync.');
    return;
  }

  // 3. Fetch machines from the Pokemon API
  console.log(`Fetching machines for ${boxes.length} state(s)...`);
  const fetched = await fetchMachines(boxes);
  console.log(`API returned ${fetched.length} machine(s).`);

  // 4. Diff against existing DB records
  const existingMachineIds = new Set(
    (await prisma.vendingMachine.findMany({ select: { machineId: true } })).map((m) => m.machineId),
  );

  const newMachines = fetched.filter((m) => !existingMachineIds.has(m.name));

  if (newMachines.length === 0) {
    console.log('No new machines found.');
    return;
  }

  console.log(`Found ${newMachines.length} new machine(s):`);

  // 5. Insert new machines and notify subscribed channels
  let inserted = 0;
  for (const machine of newMachines) {
    await prisma.vendingMachine.create({
      data: {
        machineId: machine.name,
        store: machine.retailer,
        address: machine.street,
        city: machine.city,
        state: machine.stateProvince,
        zip: machine.zipPostalCode,
        country: machine.country,
        latitude: machine.lat,
        longitude: machine.lng,
      },
    });
    console.log(
      `  + ${machine.name} — ${machine.retailer}, ${machine.city}, ${machine.stateProvince}`,
    );

    await notifyChannels(rest, machine);
    inserted++;
  }

  console.log(`[${new Date().toISOString()}] Sync complete. ${inserted} machine(s) added.`);
}

main()
  .catch((err) => {
    console.error(`[${new Date().toISOString()}] Sync failed:`, err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
