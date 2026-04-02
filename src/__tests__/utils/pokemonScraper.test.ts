import { fetchMachines } from '../../utils/pokemonScraper';
import type { BoundingBox } from '../../data/stateBoundingBoxes';

const box: BoundingBox = { swLat: 41.99, swLng: -124.57, neLat: 46.24, neLng: -116.46 };

function makeMachine(id: string) {
  return {
    id,
    name: `Q${id}`,
    retailer: 'Safeway',
    street: '123 Main St',
    city: 'Portland',
    zipPostalCode: '97201',
    stateProvince: 'OR',
    country: 'US',
    lat: 45.5,
    lng: -122.6,
    distance: 0,
  };
}

function mockResponse(machines: object[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ machines }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('fetchMachines', () => {
  it('returns machines from a single box', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      mockResponse([makeMachine('001'), makeMachine('002')]),
    );

    const promise = fetchMachines([box]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Q001');
  });

  it('returns an empty array when the API returns no machines', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse([]));

    const promise = fetchMachines([box]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(0);
  });

  it('deduplicates machines with the same id across multiple boxes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse([makeMachine('001')]));

    const promise = fetchMachines([box, box]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
  });

  it('subdivides into 4 quadrants when MAX_RESULTS (20) machines are returned', async () => {
    const fullPage = Array.from({ length: 20 }, (_, i) => makeMachine(String(i).padStart(3, '0')));

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(fullPage)) // initial box — triggers subdivision
      .mockResolvedValue(mockResponse([makeMachine('999')])); // each quadrant returns 1 machine

    const promise = fetchMachines([box]);
    await jest.runAllTimersAsync();
    await promise;

    // 1 initial call + 4 quadrant calls
    expect(global.fetch as jest.Mock).toHaveBeenCalledTimes(5);
  });

  it('retries on 429 and returns machines on eventual success', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue(mockResponse([makeMachine('001')]));

    const promise = fetchMachines([box]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
    expect(global.fetch as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it('retries on 403 and returns machines on eventual success', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValue(mockResponse([makeMachine('001')]));

    const promise = fetchMachines([box]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(1);
  });

  it('returns an empty array when all retries fail', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const promise = fetchMachines([box]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(0);
  });

  it('includes machines from all boxes', async () => {
    const box2: BoundingBox = { swLat: 32.53, swLng: -124.41, neLat: 42.01, neLng: -114.13 };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse([makeMachine('001')]))
      .mockResolvedValueOnce(mockResponse([makeMachine('002')]));

    const promise = fetchMachines([box, box2]);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toHaveLength(2);
  });
});
