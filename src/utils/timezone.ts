import { find as geoFind } from 'geo-tz';
import type { VendingMachine } from '@prisma/client';

export const STATE_TIMEZONES: Record<string, string> = {
  AK: 'America/Anchorage', AL: 'America/Chicago',  AR: 'America/Chicago',
  AZ: 'America/Phoenix',   CA: 'America/Los_Angeles', CO: 'America/Denver',
  CT: 'America/New_York',  DC: 'America/New_York',  DE: 'America/New_York',
  FL: 'America/New_York',  GA: 'America/New_York',  HI: 'Pacific/Honolulu',
  IA: 'America/Chicago',   ID: 'America/Denver',    IL: 'America/Chicago',
  IN: 'America/Indiana/Indianapolis', KS: 'America/Chicago', KY: 'America/New_York',
  LA: 'America/Chicago',   MA: 'America/New_York',  MD: 'America/New_York',
  ME: 'America/New_York',  MI: 'America/New_York',  MN: 'America/Chicago',
  MO: 'America/Chicago',   MS: 'America/Chicago',   MT: 'America/Denver',
  NC: 'America/New_York',  ND: 'America/Chicago',   NE: 'America/Chicago',
  NH: 'America/New_York',  NJ: 'America/New_York',  NM: 'America/Denver',
  NV: 'America/Los_Angeles', NY: 'America/New_York', OH: 'America/New_York',
  OK: 'America/Chicago',   OR: 'America/Los_Angeles', PA: 'America/New_York',
  RI: 'America/New_York',  SC: 'America/New_York',  SD: 'America/Chicago',
  TN: 'America/Chicago',   TX: 'America/Chicago',   UT: 'America/Denver',
  VA: 'America/New_York',  VT: 'America/New_York',  WA: 'America/Los_Angeles',
  WI: 'America/Chicago',   WV: 'America/New_York',  WY: 'America/Denver',
};

export function getMachineTimezone(machine: VendingMachine): string {
  if (machine.latitude != null && machine.longitude != null) {
    const zones = geoFind(machine.latitude, machine.longitude);
    if (zones.length > 0) return zones[0];
  }
  return STATE_TIMEZONES[machine.state] ?? 'UTC';
}

// Returns the UTC offset for `date` in the given timezone, in milliseconds.
// offset = (what Intl says the local time is, as UTC ms) - (actual UTC ms)
function getUtcOffsetMs(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  const localMs = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10) % 24, // guard against midnight being formatted as "24"
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10),
  );
  return localMs - date.getTime();
}

/**
 * Parses a wall-clock datetime string ("YYYY-MM-DD HH:MM AM") in the given
 * IANA timezone and returns the equivalent UTC Date.
 * Returns null if the format is invalid or the time components are out of range.
 */
export function parseInTimezone(wallTime: string, timezone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}) (AM|PM)$/i.exec(wallTime.trim());
  if (!match) return null;

  const [, yearS, monthS, dayS, hourS, minuteS, period] = match;
  let h = parseInt(hourS, 10);
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  else if (period.toUpperCase() === 'PM' && h !== 12) h += 12;

  if (h > 23 || parseInt(minuteS, 10) > 59) return null;

  // Step 1: treat the wall-clock components as UTC to get a rough estimate
  const naiveUtcMs = Date.UTC(
    parseInt(yearS, 10),
    parseInt(monthS, 10) - 1,
    parseInt(dayS, 10),
    h,
    parseInt(minuteS, 10),
    0,
  );

  // Step 2: find the offset at the estimate, adjust, then correct once more for DST boundaries
  const offset1 = getUtcOffsetMs(new Date(naiveUtcMs), timezone);
  const adjusted = new Date(naiveUtcMs - offset1);
  const offset2 = getUtcOffsetMs(adjusted, timezone);
  return new Date(naiveUtcMs - offset2);
}
