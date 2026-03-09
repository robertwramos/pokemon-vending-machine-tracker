import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/set-crossroads';
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

const mockMachine = { id: 1, machineId: 'SF001', store: 'Safeway', crossStreets: null };

function makeInteraction(machineId = 'SF001', crossroads = 'Main St & Oak Ave') {
  return {
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
  it('returns machines matching the focused value', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([
      { machineId: 'SF001', store: 'Safeway' },
      { machineId: 'SF002', store: 'Vons' },
    ]);

    const interaction = makeInteraction();
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'SF001 — Safeway', value: 'SF001' },
      { name: 'SF002 — Vons', value: 'SF002' },
    ]);
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
