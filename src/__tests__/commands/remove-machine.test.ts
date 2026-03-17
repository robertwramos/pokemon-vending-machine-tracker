import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/remove-machine';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    vendingMachine: { findUnique: jest.fn() },
    machineMessage: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  vendingMachine: { findUnique: jest.Mock };
  machineMessage: { findMany: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
};

const mockMachine = {
  id: 1,
  machineId: 'SF001',
  store: 'Safeway',
  address: '123 Main St',
  city: 'SF',
  state: 'CA',
  zip: '94105',
};

const mockRecord = { id: 10, messageId: 'msg1', vendingMachineId: 1, channelId: 'ch1' };

function makeInteraction(machineId = 'SF001', channelId = 'ch1') {
  const mockDelete = jest.fn().mockResolvedValue({});
  const mockFetch = jest.fn().mockResolvedValue({ delete: mockDelete });
  return {
    options: {
      getString: jest.fn().mockReturnValue(machineId),
      getFocused: jest.fn().mockReturnValue(''),
    },
    channelId,
    channel: { messages: { fetch: mockFetch } },
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    respond: jest.fn().mockResolvedValue({}),
    _mockFetch: mockFetch,
    _mockDelete: mockDelete,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('autocomplete', () => {
  it('returns machines posted in the current channel matching the search', async () => {
    mockPrisma.machineMessage.findMany.mockResolvedValue([
      { vendingMachine: { machineId: 'SF001', store: 'Safeway' } },
      { vendingMachine: { machineId: 'SF002', store: 'Vons' } },
    ]);

    const interaction = makeInteraction();
    (interaction.options.getFocused as jest.Mock).mockReturnValue('sf');
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'SF001 — Safeway', value: 'SF001' },
      { name: 'SF002 — Vons', value: 'SF002' },
    ]);
  });

  it('filters results by search term', async () => {
    mockPrisma.machineMessage.findMany.mockResolvedValue([
      { vendingMachine: { machineId: 'SF001', store: 'Safeway' } },
      { vendingMachine: { machineId: 'LA001', store: 'Vons' } },
    ]);

    const interaction = makeInteraction();
    (interaction.options.getFocused as jest.Mock).mockReturnValue('safe');
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([{ name: 'SF001 — Safeway', value: 'SF001' }]);
  });
});

describe('execute', () => {
  it('deletes the Discord message and DB record, then replies', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockPrisma.machineMessage.findUnique.mockResolvedValue(mockRecord);
    mockPrisma.machineMessage.delete.mockResolvedValue({});

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction._mockFetch).toHaveBeenCalledWith('msg1');
    expect(interaction._mockDelete).toHaveBeenCalled();
    expect(mockPrisma.machineMessage.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Removed machine `SF001`'),
    );
  });

  it('replies when no machine is found with the given ID', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(null);

    const interaction = makeInteraction('UNKNOWN');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.machineMessage.delete).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('No machine found'));
  });

  it('replies when the machine is not posted in this channel', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockPrisma.machineMessage.findUnique.mockResolvedValue(null);

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.machineMessage.delete).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('not posted in this channel'),
    );
  });

  it('still removes the DB record if the Discord message was already deleted', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(mockMachine);
    mockPrisma.machineMessage.findUnique.mockResolvedValue(mockRecord);
    mockPrisma.machineMessage.delete.mockResolvedValue({});

    const interaction = makeInteraction();
    interaction._mockFetch.mockRejectedValue(new Error('Unknown Message'));

    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.machineMessage.delete).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Removed machine'));
  });
});
