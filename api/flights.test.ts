import { describe, expect, it } from 'vitest';
import { mergeAircraft } from './flights';

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
