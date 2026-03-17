import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/deploy-by-zipcode';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    vendingMachine: { findMany: jest.fn() },
    machineMessage: { findMany: jest.fn(), create: jest.fn() },
  },
}));

jest.mock('../../utils/machineEmbed', () => ({
  buildMachineMessage: jest.fn().mockReturnValue({}),
}));

const mockPrisma = prisma as unknown as {
  vendingMachine: { findMany: jest.Mock };
  machineMessage: { findMany: jest.Mock; create: jest.Mock };
};

function makeInteraction(zip = '94105', channelId = 'ch1', guildId = 'guild1') {
  const mockSend = jest.fn().mockResolvedValue({ id: 'msg1' });
  return {
    options: {
      getString: jest.fn().mockReturnValue(zip),
      getFocused: jest.fn().mockReturnValue(zip),
    },
    channelId,
    guildId,
    channel: { send: mockSend },
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    respond: jest.fn().mockResolvedValue({}),
    _mockSend: mockSend,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('autocomplete', () => {
  it('returns zip codes matching the focused value', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([{ zip: '94105' }, { zip: '94107' }]);
    const interaction = makeInteraction('941');

    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: '94105', value: '94105' },
      { name: '94107', value: '94107' },
    ]);
  });
});

describe('execute', () => {
  it('deploys machines and replies with count', async () => {
    const machines = [
      {
        id: 1,
        store: 'Safeway',
        address: '123 Main',
        city: 'SF',
        state: 'CA',
        zip: '94105',
        machineId: 'SF001',
        crossStreets: null,
        country: null,
        latitude: null,
        longitude: null,
        status: 'Online',
        lastCheckedAt: null,
        lastCheckedBy: null,
        restockedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockPrisma.vendingMachine.findMany.mockResolvedValue(machines);
    mockPrisma.machineMessage.findMany.mockResolvedValue([]);
    mockPrisma.machineMessage.create.mockResolvedValue({});

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction._mockSend).toHaveBeenCalledTimes(1);
    expect(mockPrisma.machineMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendingMachineId: 1, channelId: 'ch1' }),
      }),
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Deployed **1** machine'),
    );
  });

  it('skips machines already posted in the channel', async () => {
    const machines = [
      { id: 1, store: 'Safeway', zip: '94105', machineId: 'SF001' },
      { id: 2, store: 'Vons', zip: '94105', machineId: 'SF002' },
    ];
    mockPrisma.vendingMachine.findMany.mockResolvedValue(machines);
    mockPrisma.machineMessage.findMany.mockResolvedValue([{ vendingMachineId: 1 }]);
    mockPrisma.machineMessage.create.mockResolvedValue({});

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction._mockSend).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('skipped **1**'));
  });

  it('replies when no machines found for the zip code', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([]);

    const interaction = makeInteraction('99999');
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction._mockSend).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      'No vending machines found in zip code 99999.',
    );
  });

  it('replies when all machines are already posted', async () => {
    const machines = [{ id: 1, zip: '94105', machineId: 'SF001' }];
    mockPrisma.vendingMachine.findMany.mockResolvedValue(machines);
    mockPrisma.machineMessage.findMany.mockResolvedValue([{ vendingMachineId: 1 }]);

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction._mockSend).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('already posted in this channel'),
    );
  });
});
