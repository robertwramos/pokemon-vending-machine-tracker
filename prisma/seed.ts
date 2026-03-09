import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface MachineDetail {
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

async function main() {
  const filePath = path.join(__dirname, '..', 'machine_details.json');
  const machines: MachineDetail[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`Seeding ${machines.length} vending machines...`);

  for (const machine of machines) {
    await prisma.vendingMachine.upsert({
      where: { machineId: machine.name },
      update: {
        store: machine.retailer,
        address: machine.street,
        city: machine.city,
        state: machine.stateProvince,
        zip: machine.zipPostalCode,
        country: machine.country,
        latitude: machine.lat,
        longitude: machine.lng,
      },
      create: {
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
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
