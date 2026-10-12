import { describe, expect, it } from 'vitest';
import { mergeAircraft } from './_lib/flight';
import { toWorldRows, type StateVector } from './world';

describe('mergeAircraft', () => {
  it('keeps the freshest fix when regions overlap', () => {
    const [flight] = mergeAircraft([
      [{ hex: 'e48045', lat: -22.3, lon: -47.4, seen_pos: 9 }],
      [{ hex: 'e48045', lat: -22.31, lon: -47.41, seen_pos: 1 }],
    ]);
    expect(flight.lat).toBe(-22.31);
    expect(flight.seenSeconds).toBe(1);
  });

  it('drops aircraft without a position', () => {
    expect(mergeAircraft([[{ hex: 'abc' }, { lat: 1, lon: 2 }]])).toEqual([]);
  });

  it('normalizes ground state, callsign and altitude', () => {
    const [flight] = mergeAircraft([
      [{ hex: 'e491a2', flight: 'GLO1440 ', lat: -23.4, lon: -46.5, alt_baro: 'ground', alt_geom: 2_400 }],
    ]);
    expect(flight).toMatchObject({ callsign: 'GLO1440', onGround: true, altitudeFt: 2_400 });
  });
});

describe('toWorldRows', () => {
  const state = (overrides: Partial<Record<number, unknown>> = {}): StateVector => {
    const base: StateVector = ['e8027c', 'LPE2470 ', 'Chile', 1, 1, -73.2834, 5.1311, 10668, false, 233.27, 16.4, -2.5, null, 11422];
    for (const [index, value] of Object.entries(overrides)) (base as unknown[])[Number(index)] = value;
    return base;
  };

  it('converts units and trims the callsign', () => {
    expect(toWorldRows([state()])).toEqual([['e8027c', 'LPE2470', 'Chile', 5.1311, -73.2834, 35000, 453, 16, -492]]);
  });

  it('skips aircraft on the ground or without a position', () => {
    expect(toWorldRows([state({ 8: true }), state({ 6: null })])).toEqual([]);
  });
});
