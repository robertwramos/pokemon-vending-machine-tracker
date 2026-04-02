import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js';
import { execute, autocomplete } from '../../commands/remove-notification';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    notification: { findMany: jest.fn(), deleteMany: jest.fn() },
  },
}));

const mockPrisma = prisma as unknown as {
  notification: { findMany: jest.Mock; deleteMany: jest.Mock };
};

function makeInteraction({
  state = 'CA',
  city = 'San Francisco',
  channelId = 'ch1',
  focused = { name: 'state', value: '' },
} = {}) {
  return {
    options: {
      getString: jest.fn((key: string) => (key === 'state' ? state : city)),
      getFocused: jest.fn().mockReturnValue(focused),
    },
    channelId,
    deferReply: jest.fn().mockResolvedValue({}),
    editReply: jest.fn().mockResolvedValue({}),
    respond: jest.fn().mockResolvedValue({}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('autocomplete', () => {
  it("returns states from the current channel's subscriptions", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ state: 'CA' }, { state: 'OR' }]);

    const interaction = makeInteraction({ focused: { name: 'state', value: '' } });
    await autocomplete(interaction as unknown as AutocompleteInteraction);

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ channelId: 'ch1' }) }),
    );
    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'CA', value: 'CA' },
      { name: 'OR', value: 'OR' },
    ]);
  });

  it("returns cities from the current channel's subscriptions filtered by state", async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
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
  it('removes a subscription and replies with success', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 });

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { channelId: 'ch1', city: 'San Francisco', state: 'CA' },
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('San Francisco, CA'),
    );
  });

  it('replies when no matching subscription exists', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 });

    const interaction = makeInteraction();
    await execute(interaction as unknown as ChatInputCommandInteraction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('no notification subscription'),
    );
  });
});
