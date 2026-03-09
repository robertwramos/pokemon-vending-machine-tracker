import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import {
  handleCheckIn,
  handleCheckInModalSubmit,
  handlePastCheckInModalSubmit,
  handleSnorlaxed,
  handleRestock,
} from '../../handlers/buttonHandlers';
import prisma from '../../lib/prisma';

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    vendingMachine: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    machineCheckIn: {
      create: jest.fn().mockResolvedValue({}),
    },
    machineRestock: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../../utils/machineEmbed', () => ({
  buildMachineMessage: jest.fn().mockReturnValue({ flags: 0, embeds: [], components: [] }),
}));

jest.mock('../../utils/timezone', () => ({
  getMachineTimezone: jest.fn().mockReturnValue('UTC'),
}));

const mockPrisma = prisma as unknown as {
  vendingMachine: { update: jest.Mock; findUnique: jest.Mock };
  machineCheckIn: { create: jest.Mock };
  machineRestock: { create: jest.Mock };
};

function makeButtonInteraction(userId = 'user123', username = 'testuser'): ButtonInteraction {
  return {
    user: { id: userId, username },
    channelId: 'channel123',
    message: { id: 'msg456', edit: jest.fn().mockResolvedValue({}) },
    showModal: jest.fn().mockResolvedValue({}),
    reply: jest.fn().mockResolvedValue({}),
  } as unknown as ButtonInteraction;
}

function makeModalInteraction(
  selectedValues: string[],
  machineId = 1,
  channelId = 'channel123',
  messageId = 'msg456',
  userId = 'user123',
  username = 'testuser',
): ModalSubmitInteraction {
  const mockChannel = {
    isTextBased: jest.fn().mockReturnValue(true),
    messages: {
      fetch: jest.fn().mockResolvedValue({ edit: jest.fn().mockResolvedValue({}) }),
    },
  };

  return {
    customId: `checkin_modal:${machineId}:${channelId}:${messageId}`,
    user: { id: userId, username },
    fields: {
      getField: jest.fn().mockReturnValue({ values: selectedValues }),
    },
    client: {
      channels: { fetch: jest.fn().mockResolvedValue(mockChannel) },
    },
    reply: jest.fn().mockResolvedValue({}),
  } as unknown as ModalSubmitInteraction;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('handleCheckIn', () => {
  it('shows a modal with the correct custom_id', async () => {
    const interaction = makeButtonInteraction();
    await handleCheckIn(interaction, 1);

    expect(interaction.showModal).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_id: 'checkin_modal:1:channel123:msg456',
        title: 'Check In',
      }),
    );
  });

  it('does not write to the database', async () => {
    const interaction = makeButtonInteraction();
    await handleCheckIn(interaction, 1);

    expect(mockPrisma.vendingMachine.update).not.toHaveBeenCalled();
    expect(mockPrisma.machineCheckIn.create).not.toHaveBeenCalled();
  });
});

describe('handleCheckInModalSubmit', () => {
  describe('with products selected', () => {
    it('updates machine status to Online with userId', async () => {
      const interaction = makeModalInteraction(['pack', 'etb'], 1, 'ch1', 'msg1', 'user123');
      await handleCheckInModalSubmit(interaction);

      expect(mockPrisma.vendingMachine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ status: 'Online', lastCheckedBy: 'user123' }),
        }),
      );
    });

    it('creates check-in record with correct product flags', async () => {
      const interaction = makeModalInteraction(['pack', 'etb', 'tin'], 1, 'ch1', 'msg1');
      await handleCheckInModalSubmit(interaction);

      expect(mockPrisma.machineCheckIn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vendingMachineId: 1,
            packAvailable: true,
            boosterBundleAvailable: false,
            etbAvailable: true,
            boosterBoxAvailable: false,
            tinAvailable: true,
            outOfStock: false,
          }),
        }),
      );
    });

    it('replies with the Online confirmation', async () => {
      const interaction = makeModalInteraction(['pack']);
      await handleCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: '✅ Checked in — machine marked **Online**.',
        ephemeral: true,
      });
    });
  });

  describe('with Out of Stock selected alone', () => {
    it('creates check-in record with outOfStock true and all products false', async () => {
      const interaction = makeModalInteraction(['out_of_stock']);
      await handleCheckInModalSubmit(interaction);

      expect(mockPrisma.machineCheckIn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            packAvailable: false,
            boosterBundleAvailable: false,
            etbAvailable: false,
            boosterBoxAvailable: false,
            tinAvailable: false,
            outOfStock: true,
          }),
        }),
      );
    });

    it('still sets machine status to Online', async () => {
      const interaction = makeModalInteraction(['out_of_stock']);
      await handleCheckInModalSubmit(interaction);

      expect(mockPrisma.vendingMachine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'Online' }),
        }),
      );
    });

    it('replies with the Out of Stock confirmation', async () => {
      const interaction = makeModalInteraction(['out_of_stock']);
      await handleCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: '📭 Checked in — machine marked **Out of Stock**.',
        ephemeral: true,
      });
    });
  });

  describe('with Out of Stock and products selected (conflict)', () => {
    it('records outOfStock true and clears all product flags', async () => {
      const interaction = makeModalInteraction(['pack', 'etb', 'out_of_stock']);
      await handleCheckInModalSubmit(interaction);

      expect(mockPrisma.machineCheckIn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            packAvailable: false,
            etbAvailable: false,
            outOfStock: true,
          }),
        }),
      );
    });

    it('replies with the conflict warning message', async () => {
      const interaction = makeModalInteraction(['pack', 'out_of_stock']);
      await handleCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Out of Stock'),
        ephemeral: true,
      });
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('another check-in'),
        ephemeral: true,
      });
    });
  });

  describe('message refresh', () => {
    it('fetches the channel and edits the original message on success', async () => {
      const mockEdit = jest.fn().mockResolvedValue({});
      const mockMsg = { edit: mockEdit };
      const mockChannel = {
        isTextBased: jest.fn().mockReturnValue(true),
        messages: { fetch: jest.fn().mockResolvedValue(mockMsg) },
      };
      const mockFetch = jest.fn().mockResolvedValue(mockChannel);

      mockPrisma.vendingMachine.findUnique.mockResolvedValue({ id: 1 });

      const interaction = makeModalInteraction(['pack'], 1, 'ch1', 'msg1');
      (interaction.client.channels.fetch as jest.Mock) = mockFetch;

      await handleCheckInModalSubmit(interaction);

      expect(mockFetch).toHaveBeenCalledWith('ch1');
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg1');
      expect(mockEdit).toHaveBeenCalled();
    });

    it('still replies successfully if the message refresh fails', async () => {
      const interaction = makeModalInteraction(['pack']);
      (interaction.client.channels.fetch as jest.Mock).mockRejectedValue(
        new Error('Channel not found'),
      );

      await handleCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: '✅ Checked in — machine marked **Online**.' }),
      );
    });
  });
});

describe('handleSnorlaxed', () => {
  it('updates the machine status to Snorlaxed with userId', async () => {
    const interaction = makeButtonInteraction();
    await handleSnorlaxed(interaction, 2);

    expect(mockPrisma.vendingMachine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({ status: 'Snorlaxed', lastCheckedBy: 'user123' }),
      }),
    );
  });

  it('replies with the snorlaxed confirmation message', async () => {
    const interaction = makeButtonInteraction();
    await handleSnorlaxed(interaction, 2);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: '😴 Machine marked **Snorlaxed**.',
      ephemeral: true,
    });
  });
});

function makePastCheckInModalInteraction(
  selectedValues: string[],
  machineDbId = 1,
  utcMs = new Date('2024-01-15T18:30:00.000Z').getTime(),
  username = 'testuser',
): ModalSubmitInteraction {
  return {
    customId: `past_checkin_modal:${machineDbId}:${utcMs}`,
    user: { username },
    fields: {
      getField: jest.fn().mockReturnValue({ values: selectedValues }),
    },
    reply: jest.fn().mockResolvedValue({}),
  } as unknown as ModalSubmitInteraction;
}

describe('handleRestock', () => {
  it('updates the machine restockedAt', async () => {
    const interaction = makeButtonInteraction();
    await handleRestock(interaction, 3);

    expect(mockPrisma.vendingMachine.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 3 },
        data: expect.objectContaining({ restockedAt: expect.any(Date) }),
      }),
    );
  });

  it('creates a restock record with username', async () => {
    const interaction = makeButtonInteraction('user123', 'testuser');
    await handleRestock(interaction, 3);

    expect(mockPrisma.machineRestock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vendingMachineId: 3, reportedBy: 'testuser' }),
      }),
    );
  });

  it('replies with the restock confirmation message', async () => {
    const interaction = makeButtonInteraction();
    await handleRestock(interaction, 3);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: '📦 Restock reported — thanks!',
      ephemeral: true,
    });
  });
});

describe('handlePastCheckInModalSubmit', () => {
  const utcMs = new Date('2024-01-15T18:30:00.000Z').getTime();

  beforeEach(() => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue({
      id: 1, state: 'CA', latitude: null, longitude: null,
    });
  });

  it('does NOT update lastCheckedAt or status on the machine', async () => {
    const interaction = makePastCheckInModalInteraction(['pack'], 1, utcMs);
    await handlePastCheckInModalSubmit(interaction);

    expect(mockPrisma.vendingMachine.update).not.toHaveBeenCalled();
  });

  describe('with products selected', () => {
    it('creates a check-in record with the past timestamp and correct product flags', async () => {
      const interaction = makePastCheckInModalInteraction(['pack', 'etb', 'tin'], 1, utcMs);
      await handlePastCheckInModalSubmit(interaction);

      expect(mockPrisma.machineCheckIn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vendingMachineId: 1,
            checkedAt: new Date(utcMs),
            checkedBy: 'testuser',
            packAvailable: true,
            boosterBundleAvailable: false,
            etbAvailable: true,
            boosterBoxAvailable: false,
            tinAvailable: true,
            outOfStock: false,
          }),
        }),
      );
    });

    it('replies with Online confirmation including timezone', async () => {
      const interaction = makePastCheckInModalInteraction(['pack'], 1, utcMs);
      await handlePastCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Online'),
          ephemeral: true,
        }),
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('UTC') }),
      );
    });
  });

  describe('with Out of Stock selected alone', () => {
    it('creates a check-in record with outOfStock true and all products false', async () => {
      const interaction = makePastCheckInModalInteraction(['out_of_stock'], 1, utcMs);
      await handlePastCheckInModalSubmit(interaction);

      expect(mockPrisma.machineCheckIn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            packAvailable: false,
            etbAvailable: false,
            outOfStock: true,
          }),
        }),
      );
    });

    it('replies with Out of Stock confirmation', async () => {
      const interaction = makePastCheckInModalInteraction(['out_of_stock'], 1, utcMs);
      await handlePastCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Out of Stock') }),
      );
    });
  });

  describe('with Out of Stock and products selected (conflict)', () => {
    it('records outOfStock true and clears product flags', async () => {
      const interaction = makePastCheckInModalInteraction(['pack', 'out_of_stock'], 1, utcMs);
      await handlePastCheckInModalSubmit(interaction);

      expect(mockPrisma.machineCheckIn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ packAvailable: false, outOfStock: true }),
        }),
      );
    });

    it('replies with the conflict warning', async () => {
      const interaction = makePastCheckInModalInteraction(['pack', 'out_of_stock'], 1, utcMs);
      await handlePastCheckInModalSubmit(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Out of Stock') }),
      );
    });
  });

  it('uses UTC timezone when machine is not found', async () => {
    mockPrisma.vendingMachine.findUnique.mockResolvedValue(null);
    const interaction = makePastCheckInModalInteraction(['pack'], 1, utcMs);
    await handlePastCheckInModalSubmit(interaction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('UTC') }),
    );
  });
});
