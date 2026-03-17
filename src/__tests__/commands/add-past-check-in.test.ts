import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/add-past-check-in';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    vendingMachine: { findUnique: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('../../utils/timezone', () => ({
  getMachineTimezone: jest.fn().mockReturnValue('America/Los_Angeles'),
  parseInTimezone: jest.fn(),
}));

import { getMachineTimezone, parseInTimezone } from '../../utils/timezone';

const mockPrisma = prisma as unknown as {
  vendingMachine: { findUnique: jest.Mock; findMany: jest.Mock };
};
const mockGetMachineTimezone = getMachineTimezone as jest.Mock;
const mockParseInTimezone = parseInTimezone as jest.Mock;

const mockMachine = {
  id: 42,
  machineId: 'SF001',
  store: 'Safeway',
  address: '123 Main St',
  crossStreets: null,
  state: 'CA',
  latitude: null,
  longitude: null,
};

function makeInteraction(machineId = 'SF001', datetime = '2024-06-01 10:30 AM', channelId = 'ch1') {
  return {
    channelId,
    options: {
      getString: jest.fn((key: string) => (key === 'machine_id' ? machineId : datetime)),
      getFocused: jest.fn().mockReturnValue(''),
    },
    reply: jest.fn().mockResolvedValue({}),
    showModal: jest.fn().mockResolvedValue({}),
    respond: jest.fn().mockResolvedValue({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('autocomplete', () => {
  it('includes machineId, store, and crossStreets in label when crossStreets is set', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([
      {
        machineId: 'SF001',
        store: 'Safeway',
        crossStreets: 'Main St & Oak Ave',
        address: '123 Main St',
      },
    ]);

    const interaction = makeInteraction('SF001', '2024-06-01 10:30 AM', 'ch1');
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'SF001 — Safeway — Main St & Oak Ave', value: 'SF001' },
    ]);
  });

  it('falls back to address in label when crossStreets is null', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([
      { machineId: 'SF002', store: 'Vons', crossStreets: null, address: '456 Elm St' },
    ]);

    const interaction = makeInteraction('SF002', '2024-06-01 10:30 AM', 'ch1');
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'SF002 — Vons — 456 Elm St', value: 'SF002' },
    ]);
  });

  it('filters by the current channelId', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([]);

    const interaction = makeInteraction('SF001', '2024-06-01 10:30 AM', 'ch-specific');
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(mockPrisma.vendingMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              machineMessages: { some: { channelId: 'ch-specific' } },
            }),
          ]),
        }),
      }),
    );
  });

  it('returns multiple results', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([
      { machineId: 'SF001', store: 'Safeway', crossStreets: 'A & B', address: '1 A St' },
      { machineId: 'SF002', store: 'Vons', crossStreets: null, address: '2 B St' },
    ]);

    const interaction = makeInteraction();
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'SF001 — Safeway — A & B', value: 'SF001' },
      { name: 'SF002 — Vons — 2 B St', value: 'SF002' },
    ]);
  });
});

describe('execute', () => {
  it('replies with an error when machine is not found', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(null);

    const interaction = makeInteraction('UNKNOWN');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No machine found'),
        ephemeral: true,
      }),
    );
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it('replies with an error when the datetime format is invalid', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockParseInTimezone.mockReturnValue(null);

    const interaction = makeInteraction('SF001', 'not-a-date');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Invalid datetime format'),
        ephemeral: true,
      }),
    );
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it('replies with an error when the datetime is in the future', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // tomorrow
    mockParseInTimezone.mockReturnValue(futureDate);

    const interaction = makeInteraction('SF001', '2099-01-01 12:00 PM');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('future'),
        ephemeral: true,
      }),
    );
    expect(interaction.showModal).not.toHaveBeenCalled();
  });

  it('shows the product modal with the correct custom_id on valid input', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    const pastDate = new Date('2024-06-01T17:30:00.000Z');
    mockParseInTimezone.mockReturnValue(pastDate);

    const interaction = makeInteraction('SF001', '2024-06-01 10:30 AM');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_id: `past_checkin_modal:42:${pastDate.getTime()}`,
        title: 'Past Check-In',
      }),
    );
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('passes the machine to getMachineTimezone', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockParseInTimezone.mockReturnValue(new Date('2024-06-01T17:30:00.000Z'));

    const interaction = makeInteraction('SF001', '2024-06-01 10:30 AM');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockGetMachineTimezone).toHaveBeenCalledWith(mockMachine);
  });

  it('passes the timezone from getMachineTimezone to parseInTimezone', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockGetMachineTimezone.mockReturnValue('America/Chicago');
    mockParseInTimezone.mockReturnValue(new Date('2024-06-01T15:30:00.000Z'));

    const interaction = makeInteraction('SF001', '2024-06-01 10:30 AM');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockParseInTimezone).toHaveBeenCalledWith('2024-06-01 10:30 AM', 'America/Chicago');
  });
});
