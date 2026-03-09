#!/usr/bin/env node
/**
 * Fetches detailed machine data from the Pokemon vending machine API.
 * Uses a recursive bounding box strategy: if a query returns exactly 20 results
 * (the API's max), the box is split into 4 quadrants and each is re-queried.
 * This minimizes total API calls while ensuring full coverage.
 *
 * Output: machine_details.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://api.vending.prod.pokemon.com/v1/machines';
const MAX_RESULTS = 20;
const DELAY_MS = 500;
const MAX_DEPTH = 12;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 5000;

const allMachines = new Map();
let totalRequests = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBox(swLat, swLng, neLat, neLng, depth = 0) {
  const url = `${BASE_URL}?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}&unit=mi`;
  totalRequests++;

  let machines;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 403 || res.status === 429) {
        const waitMs = RETRY_BASE_MS * attempt;
        console.warn(
          `  [RATE LIMITED] attempt=${attempt}/${MAX_RETRIES}, waiting ${waitMs / 1000}s...`,
        );
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      machines = data.machines ?? [];
      break;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`  [ERROR] depth=${depth} ${url}\n  ${err.message}`);
        return;
      }
    }
  }

  if (!machines) return;

  console.log(
    `  [depth=${depth}] box=(${swLat.toFixed(3)},${swLng.toFixed(3)}) -> (${neLat.toFixed(3)},${neLng.toFixed(3)}) => ${machines.length} results`,
  );

  if (machines.length === MAX_RESULTS && depth < MAX_DEPTH) {
    // Possibly truncated — subdivide into 4 quadrants
    const midLat = (swLat + neLat) / 2;
    const midLng = (swLng + neLng) / 2;

    await sleep(DELAY_MS);
    await fetchBox(swLat, swLng, midLat, midLng, depth + 1); // SW
    await sleep(DELAY_MS);
    await fetchBox(midLat, swLng, neLat, midLng, depth + 1); // NW
    await sleep(DELAY_MS);
    await fetchBox(swLat, midLng, midLat, neLng, depth + 1); // SE
    await sleep(DELAY_MS);
    await fetchBox(midLat, midLng, neLat, neLng, depth + 1); // NE
  } else {
    for (const machine of machines) {
      allMachines.set(machine.id, machine);
    }
  }
}

async function main() {
  console.log('Fetching Pokemon vending machine data for the US...');

  // Full US bounding box (including AK + HI)
  await fetchBox(18.776286, -179.231086, 71.5388, -66.885444);

  const results = Array.from(allMachines.values());
  const outPath = path.join(__dirname, '..', 'machine_details.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`\nDone. ${results.length} unique machines saved to machine_details.json`);
  console.log(`Total API requests made: ${totalRequests}`);
}

main();
