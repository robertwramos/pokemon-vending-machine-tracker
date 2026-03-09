import { getRetailerLogo } from '../../utils/retailers';

const FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';
const FALLBACK = `${FAVICON_BASE}pokemoncenter.com&sz=128`;

describe('getRetailerLogo', () => {
  it('returns the correct favicon URL for a known store', () => {
    expect(getRetailerLogo('Safeway')).toBe(`${FAVICON_BASE}safeway.com&sz=128`);
  });

  it('returns correct URLs for several known stores', () => {
    expect(getRetailerLogo('Kroger')).toBe(`${FAVICON_BASE}kroger.com&sz=128`);
    expect(getRetailerLogo('Ralphs')).toBe(`${FAVICON_BASE}ralphs.com&sz=128`);
    expect(getRetailerLogo('H-E-B')).toBe(`${FAVICON_BASE}heb.com&sz=128`);
  });

  it('returns the fallback URL for an unknown store', () => {
    expect(getRetailerLogo('Unknown Store')).toBe(FALLBACK);
  });

  it('is case-sensitive and falls back for wrong casing', () => {
    expect(getRetailerLogo('safeway')).toBe(FALLBACK);
    expect(getRetailerLogo('KROGER')).toBe(FALLBACK);
  });
});
