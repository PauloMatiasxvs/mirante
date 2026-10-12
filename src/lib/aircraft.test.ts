import { describe, expect, it } from 'vitest';
import { aircraftModel, flightLevel, flightName, verticalTrend, type Flight } from './aircraft';

const flight = (overrides: Partial<Flight> = {}): Flight => ({
  id: 'e48045',
  callsign: 'TAM3108',
  registration: 'PR-MHJ',
  type: 'A320',
  lat: -22.3,
  lon: -47.4,
  onGround: false,
  altitudeFt: 34_000,
  speedKt: 405,
  track: 349,
  verticalRateFpm: 0,
  squawk: null,
  seenSeconds: 0,
  ...overrides,
});

describe('flightLevel', () => {
  it('reports hundreds of feet', () => {
    expect(flightLevel(flight())).toBe('FL340');
    expect(flightLevel(flight({ altitudeFt: 3_850 }))).toBe('FL039');
  });

  it('marks aircraft on the ground', () => {
    expect(flightLevel(flight({ onGround: true }))).toBe('SOLO');
  });
});

describe('flightName', () => {
  it('prefers the callsign, then the registration, then the ICAO hex', () => {
    expect(flightName(flight())).toBe('TAM3108');
    expect(flightName(flight({ callsign: null }))).toBe('PR-MHJ');
    expect(flightName(flight({ callsign: null, registration: null }))).toBe('E48045');
  });
});

describe('aircraftModel', () => {
  it('expands known type codes and passes unknown ones through', () => {
    expect(aircraftModel(flight())).toBe('Airbus A320');
    expect(aircraftModel(flight({ type: 'BE40' }))).toBe('BE40');
    expect(aircraftModel(flight({ type: null }))).toBe('');
  });
});

describe('verticalTrend', () => {
  it('ignores small rates', () => {
    expect(verticalTrend(150)).toBe('level');
    expect(verticalTrend(1_920)).toBe('climbing');
    expect(verticalTrend(-896)).toBe('descending');
  });
});
