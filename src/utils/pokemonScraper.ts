import type { BoundingBox } from '../data/stateBoundingBoxes';

const BASE_URL = 'https://api.vending.prod.pokemon.com/v1/machines';
const MAX_RESULTS = 20;
const DELAY_MS = 500;
const MAX_DEPTH = 12;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 5000;

export interface PokemonMachine {
  id: string;
  name: string;
  retailer: string;
  street: string;
  city: string;
  zipPostalCode: string;
  stateProvince: string;
  country: string;
  lat: number;
  lng: number;
}

interface ApiResponse {
  machines: PokemonMachine[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBox(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  allMachines: Map<string, PokemonMachine>,
  depth = 0,
): Promise<void> {
  const url = `${BASE_URL}?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}&unit=mi`;

  let machines: PokemonMachine[] | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 403 || res.status === 429) {
        const waitMs = RETRY_BASE_MS * attempt;
        console.warn(
          `[scraper] rate limited, attempt ${attempt}/${MAX_RETRIES}, waiting ${waitMs / 1000}s...`,
        );
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      machines = data.machines ?? [];
      break;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`[scraper] failed at depth=${depth} ${url}: ${(err as Error).message}`);
        return;
      }
    }
  }

  if (!machines) return;

  if (machines.length === MAX_RESULTS && depth < MAX_DEPTH) {
    const midLat = (swLat + neLat) / 2;
    const midLng = (swLng + neLng) / 2;

    await sleep(DELAY_MS);
    await fetchBox(swLat, swLng, midLat, midLng, allMachines, depth + 1); // SW
    await sleep(DELAY_MS);
    await fetchBox(midLat, swLng, neLat, midLng, allMachines, depth + 1); // NW
    await sleep(DELAY_MS);
    await fetchBox(swLat, midLng, midLat, neLng, allMachines, depth + 1); // SE
    await sleep(DELAY_MS);
    await fetchBox(midLat, midLng, neLat, neLng, allMachines, depth + 1); // NE
  } else {
    for (const machine of machines) {
      allMachines.set(machine.id, machine);
    }
  }
}

export async function fetchMachines(boxes: BoundingBox[]): Promise<PokemonMachine[]> {
  const allMachines = new Map<string, PokemonMachine>();

  for (const box of boxes) {
    await fetchBox(box.swLat, box.swLng, box.neLat, box.neLng, allMachines);
  }

  return Array.from(allMachines.values());
}
