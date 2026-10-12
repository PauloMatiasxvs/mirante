import type { Flight } from '../../api/flights';

export type { Flight };

// Most common ICAO type codes in Brazilian skies.
const AIRCRAFT_TYPES: Record<string, string> = {
  A319: 'Airbus A319',
  A320: 'Airbus A320',
  A20N: 'Airbus A320neo',
  A321: 'Airbus A321',
  A21N: 'Airbus A321neo',
  A332: 'Airbus A330-200',
  A339: 'Airbus A330-900neo',
  A359: 'Airbus A350-900',
  AT72: 'ATR 72',
  AT76: 'ATR 72-600',
  B737: 'Boeing 737-700',
  B738: 'Boeing 737-800',
  B38M: 'Boeing 737 MAX 8',
  B763: 'Boeing 767-300',
  B77W: 'Boeing 777-300ER',
  B788: 'Boeing 787-8',
  B789: 'Boeing 787-9',
  E190: 'Embraer E190',
  E195: 'Embraer E195',
  E295: 'Embraer E195-E2',
  E145: 'Embraer ERJ-145',
  E35L: 'Embraer Legacy 600',
  E55P: 'Embraer Phenom 300',
  C208: 'Cessna Caravan',
};

export const FEET_TO_METERS = 0.3048;
export const KNOTS_TO_MPS = 0.514444;

export const aircraftModel = (flight: Flight) =>
  (flight.type && AIRCRAFT_TYPES[flight.type]) ?? flight.type ?? '';

export const flightName = (flight: Flight) =>
  flight.callsign ?? flight.registration ?? flight.id.toUpperCase();

/** Flight level in hundreds of feet: 34,000 ft is FL340. */
export function flightLevel(flight: Flight): string {
  if (flight.onGround || flight.altitudeFt == null) return 'SOLO';
  return `FL${String(Math.max(0, Math.round(flight.altitudeFt / 100))).padStart(3, '0')}`;
}

export function verticalTrend(fpm: number | null): 'level' | 'climbing' | 'descending' {
  if (fpm == null || Math.abs(fpm) < 200) return 'level';
  return fpm > 0 ? 'climbing' : 'descending';
}
