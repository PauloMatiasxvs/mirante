import { describe, expect, it } from 'vitest';
import { destination, normalizeDegrees, sunElevation } from './geo';

describe('destination', () => {
  it('moves about one degree of latitude per 111 km going north', () => {
    const point = destination({ lat: 0, lon: 0 }, 0, 111_195);
    expect(point.lat).toBeCloseTo(1, 3);
    expect(point.lon).toBeCloseTo(0, 6);
  });

  it('wraps longitude across the antimeridian', () => {
    const point = destination({ lat: 0, lon: 179.9 }, 90, 50_000);
    expect(point.lon).toBeLessThan(-179);
  });
});

describe('sunElevation', () => {
  it('puts the sun nearly overhead at the equator on an equinox noon', () => {
    expect(sunElevation(new Date('2024-03-20T12:07:00Z'), 0, 0)).toBeGreaterThan(88);
  });

  it('is below the horizon at local midnight', () => {
    expect(sunElevation(new Date('2024-06-21T03:00:00Z'), -23.55, -46.63)).toBeLessThan(-40);
  });
});

describe('normalizeDegrees', () => {
  it.each([
    [370, 10],
    [-10, 350],
    [360, 0],
  ])('normalizes %d to %d', (input, expected) => {
    expect(normalizeDegrees(input)).toBe(expected);
  });
});
