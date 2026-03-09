import { ButtonStyle } from 'discord.js';
import type { VendingMachine } from '@prisma/client';
import { buildMachineEmbed, buildMachineButtons } from '../../utils/machineEmbed';

function makeMachine(overrides: Partial<VendingMachine> = {}): VendingMachine {
  return {
    id: 1,
    store: 'Safeway',
    address: '123 Main St',
    machineId: 'SF001',
    crossStreets: null,
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: null,
    latitude: null,
    longitude: null,
    status: 'Online',
    lastCheckedAt: null,
    lastCheckedBy: null,
    restockedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('buildMachineEmbed', () => {
  it('sets author, description, footer, and color', () => {
    const embed = buildMachineEmbed(makeMachine());
    expect(embed.data.author?.name).toBe('Safeway');
    expect(embed.data.description).toBe('123 Main St\nSan Francisco, CA 94105');
    expect(embed.data.footer?.text).toBe('SF001');
    expect(embed.data.color).toBe(0x3b4cca);
  });

  it('shows the correct status emoji for each status', () => {
    const cases: [string, string][] = [
      ['Online', '🟢'],
      ['Snorlaxed', '🔴'],
      ['Restocking', '🔵'],
      ['unknown', '⚪'],
      ['something-else', '⚪'],
    ];
    for (const [status, emoji] of cases) {
      const embed = buildMachineEmbed(makeMachine({ status }));
      const statusField = embed.data.fields?.find((f) => f.name === 'Status');
      expect(statusField?.value).toBe(`${emoji} ${status}`);
    }
  });

  it('omits Last Checked field when lastCheckedAt is null', () => {
    const embed = buildMachineEmbed(makeMachine({ lastCheckedAt: null }));
    const field = embed.data.fields?.find((f) => f.name === 'Last Checked');
    expect(field).toBeUndefined();
  });

  it('includes Last Checked with absolute timestamp and user mention', () => {
    const checkedAt = new Date('2024-06-01T12:00:00.000Z');
    const ts = Math.floor(checkedAt.getTime() / 1000);
    const embed = buildMachineEmbed(
      makeMachine({ lastCheckedAt: checkedAt, lastCheckedBy: 'user123' }),
    );
    const field = embed.data.fields?.find((f) => f.name === 'Last Checked');
    expect(field?.value).toBe(`<t:${ts}:f> by <@user123>`);
    expect(field?.inline).toBe(true);
  });

  it('omits Last Restocked field when restockedAt is null', () => {
    const embed = buildMachineEmbed(makeMachine({ restockedAt: null }));
    const field = embed.data.fields?.find((f) => f.name === 'Last Restocked');
    expect(field).toBeUndefined();
  });

  it('includes Last Restocked with absolute timestamp', () => {
    const restockedAt = new Date('2024-05-15T08:30:00.000Z');
    const ts = Math.floor(restockedAt.getTime() / 1000);
    const embed = buildMachineEmbed(makeMachine({ restockedAt }));
    const field = embed.data.fields?.find((f) => f.name === 'Last Restocked');
    expect(field?.value).toBe(`<t:${ts}:f>`);
    expect(field?.inline).toBe(true);
  });
});

describe('buildMachineButtons', () => {
  it('creates a row with four buttons', () => {
    const row = buildMachineButtons(42);
    expect(row.components).toHaveLength(4);
  });

  it('Check In button has correct label, style, and customId', () => {
    const row = buildMachineButtons(42);
    const btn = row.components[0].data as Record<string, unknown>;
    expect(btn['label']).toBe('Check In');
    expect(btn['style']).toBe(ButtonStyle.Success);
    expect(btn['custom_id']).toBe('checkin:42');
  });

  it('Snorlaxed button has correct label, style, and customId', () => {
    const row = buildMachineButtons(42);
    const btn = row.components[1].data as Record<string, unknown>;
    expect(btn['label']).toBe('Snorlaxed');
    expect(btn['style']).toBe(ButtonStyle.Danger);
    expect(btn['custom_id']).toBe('snorlaxed:42');
  });

  it('Restocked button has correct label, style, and customId', () => {
    const row = buildMachineButtons(42);
    const btn = row.components[2].data as Record<string, unknown>;
    expect(btn['label']).toBe('Restocked');
    expect(btn['style']).toBe(ButtonStyle.Primary);
    expect(btn['custom_id']).toBe('restock:42');
  });

  it('Check Logs button has correct label, style, and customId', () => {
    const row = buildMachineButtons(42);
    const btn = row.components[3].data as Record<string, unknown>;
    expect(btn['label']).toBe('Check Logs');
    expect(btn['style']).toBe(ButtonStyle.Secondary);
    expect(btn['custom_id']).toBe('logs:42');
  });
});
