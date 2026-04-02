import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/add-notification';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    vendingMachine: { findMany: jest.fn() },
    notification: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  vendingMachine: { findMany: jest.Mock };
  notification: { findUnique: jest.Mock; create: jest.Mock };
};

function makeInteraction({
  state = 'CA',
  city = 'San Francisco',
  channelId = 'ch1',
  guildId = 'guild1',
  focused = { name: 'state', value: '' },
} = {}) {
  return {
    options: {
      getString: jest.fn((key: string) => (key === 'state' ? state : city)),
      getFocused: jest.fn().mockReturnValue(focused),
    },
    channelId,
    guildId,
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    respond: jest.fn().mockResolvedValue({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('autocomplete', () => {
  it('returns distinct states matching the focused value', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([{ state: 'CA' }, { state: 'CO' }]);

    const interaction = makeInteraction({ focused: { name: 'state', value: 'C' } });
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'CA', value: 'CA' },
      { name: 'CO', value: 'CO' },
    ]);
  });

  it('returns distinct cities matching the focused value filtered by state', async () => {
    mockPrisma.vendingMachine.findMany.mockResolvedValue([
      { city: 'San Francisco' },
      { city: 'San Jose' },
    ]);

    const interaction = makeInteraction({ focused: { name: 'city', value: 'San' } });
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'San Francisco', value: 'San Francisco' },
      { name: 'San Jose', value: 'San Jose' },
    ]);
  });
});

describe('execute', () => {
  it('creates a notification and replies with success', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue(null);
    mockPrisma.notification.create.mockResolvedValue({});

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: { channelId: 'ch1', guildId: 'guild1', city: 'San Francisco', state: 'CA' },
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('San Francisco, CA'),
    );
  });

  it('replies when the channel is already subscribed to that city and state', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({ id: 1 });

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('already set up'));
  });
});
