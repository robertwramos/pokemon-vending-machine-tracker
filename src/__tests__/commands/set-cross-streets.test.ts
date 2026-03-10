import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/set-cross-streets';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    vendingMachine: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    machineMessage: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.mock('../../utils/machineEmbed', () => ({
  buildMachineMessage: jest.fn().mockReturnValue({ flags: 0, embeds: [], components: [] }),
}));

const mockPrisma = prisma as unknown as {
  vendingMachine: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  machineMessage: { findMany: jest.Mock };
};

const mockMachine = { id: 1, machineId: 'SF001', store: 'Safeway', address: '123 Main St', crossStreets: null };

function makeInteraction(machineId = 'SF001', crossroads = 'Main St & Oak Ave', channelId = 'ch-123') {
  return {
    channelId,
    options: {
      getString: jest.fn((key: string) => (key === 'machine_id' ? machineId : crossroads)),
      getFocused: jest.fn().mockReturnValue(''),
    },
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    respond: jest.fn().mockResolvedValue({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('autocomplete', () => {
  it('returns only machines in the current channel with address in the label', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([
      { machineId: 'SF001', store: 'Safeway', address: '123 Main St' },
      { machineId: 'SF002', store: 'Vons', address: '456 Oak Ave' },
    ]);

    const interaction = makeInteraction();
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(mockPrisma.vendingMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          machineMessages: { some: { channelId: 'ch-123' } },
        }),
      }),
    );
    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'SF001 — Safeway (123 Main St)', value: 'SF001' },
      { name: 'SF002 — Vons (456 Oak Ave)', value: 'SF002' },
    ]);
  });

  it('passes the focused value as a filter', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([]);
    const interaction = makeInteraction();
    (interaction.options.getFocused as jest.Mock).mockReturnValue('SF');

    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(mockPrisma.vendingMachine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ machineId: { contains: 'SF' } }, { store: { contains: 'SF' } }],
        }),
      }),
    );
  });
});

describe('execute', () => {
  it('updates crossStreets and replies with confirmation', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockPrisma.vendingMachine.update.mockResolvedValue({ ...mockMachine, crossStreets: 'Main St & Oak Ave' });

    const interaction = makeInteraction('SF001', 'Main St & Oak Ave');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.vendingMachine.update).toHaveBeenCalledWith({
      where: { machineId: 'SF001' },
      data: { crossStreets: 'Main St & Oak Ave' },
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Main St & Oak Ave'),
    );
  });

  it('overwrites existing cross streets', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue({
      ...mockMachine,
      crossStreets: 'Old St & Elm Ave',
    });
    mockPrisma.vendingMachine.update.mockResolvedValue({ ...mockMachine, crossStreets: 'New Rd & Park Blvd' });

    const interaction = makeInteraction('SF001', 'New Rd & Park Blvd');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.vendingMachine.update).toHaveBeenCalledWith({
      where: { machineId: 'SF001' },
      data: { crossStreets: 'New Rd & Park Blvd' },
    });
  });

  it('replies when no machine is found with the given ID', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(null);

    const interaction = makeInteraction('UNKNOWN');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.vendingMachine.update).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('No machine found'),
    );
  });
});
