export interface Flight {
  id: string;
  callsign: string | null;
  registration: string | null;
  type: string | null;
  lat: number;
  lon: number;
  onGround: boolean;
  altitudeFt: number | null;
  speedKt: number | null;
  track: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  seenSeconds: number;
  originCountry?: string;
}

export interface FlightsResponse {
  updatedAt: string;
  source: string;
  partial: boolean;
  flights: Flight[];
}

/** Aircraft as returned by the adsb.lol (readsb) API. */
export interface RawAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  seen_pos?: number;
}

type PositionedAircraft = RawAircraft & { hex: string; lat: number; lon: number };

export const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const hasPosition = (raw: RawAircraft): raw is PositionedAircraft =>
  Boolean(raw.hex) && typeof raw.lat === 'number' && typeof raw.lon === 'number';

export function toFlight(raw: PositionedAircraft): Flight {
  return {
    id: raw.hex,
    callsign: String(raw.flight ?? '').trim() || null,
    registration: raw.r || null,
    type: raw.t || null,
    lat: raw.lat,
    lon: raw.lon,
    onGround: raw.alt_baro === 'ground',
    altitudeFt: finite(raw.alt_baro) ?? finite(raw.alt_geom),
    speedKt: finite(raw.gs),
    track: finite(raw.track),
    verticalRateFpm: finite(raw.baro_rate) ?? finite(raw.geom_rate),
    squawk: raw.squawk || null,
    seenSeconds: finite(raw.seen_pos) ?? 0,
  };
}

// Overlapping queries can return the same aircraft twice: keep the freshest fix.
export function mergeAircraft(batches: RawAircraft[][]): Flight[] {
  const byId = new Map<string, PositionedAircraft>();
  for (const aircraft of batches.flat()) {
    if (!hasPosition(aircraft)) continue;
    const previous = byId.get(aircraft.hex);
    if (!previous || (aircraft.seen_pos ?? 99) < (previous.seen_pos ?? 99)) {
      byId.set(aircraft.hex, aircraft);
    }
  }
  return [...byId.values()].map(toFlight);
}
