import { cachedRoute } from './_lib/cachedRoute.js';

// Every airborne aircraft OpenSky sees worldwide. Anonymous access allows about
// 100 whole-world queries a day, so the snapshot is refreshed every 15 minutes
// and the client dead-reckons each plane in between.

/** [icao24, callsign, country, lat, lon, altitudeFt, speedKt, track, verticalRateFpm] */
export type WorldFlightRow = [
  string,
  string,
  string,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
];

export interface WorldResponse {
  updatedAt: string;
  /** Unix ms of the snapshot the positions refer to. */
  positionTime: number;
  source: 'opensky';
  flights: WorldFlightRow[];
}

// https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
export type StateVector = [
  icao24: string,
  callsign: string | null,
  originCountry: string,
  timePosition: number | null,
  lastContact: number,
  longitude: number | null,
  latitude: number | null,
  baroAltitude: number | null,
  onGround: boolean,
  velocity: number | null,
  trueTrack: number | null,
  verticalRate: number | null,
  sensors: unknown,
  geoAltitude: number | null,
  ...rest: unknown[],
];

const M_TO_FT = 3.28084;
const MPS_TO_KT = 1.94384;
const MPS_TO_FPM = 196.85;

const scaled = (value: number | null, factor: number) => (value == null ? null : Math.round(value * factor));

export function toWorldRows(states: StateVector[]): WorldFlightRow[] {
  const rows: WorldFlightRow[] = [];
  for (const [icao, callsign, country, , , lon, lat, baroAlt, onGround, velocity, track, verticalRate, , geoAlt] of states) {
    if (onGround || lat == null || lon == null) continue;
    rows.push([
      icao,
      (callsign ?? '').trim(),
      country,
      Math.round(lat * 1e4) / 1e4,
      Math.round(lon * 1e4) / 1e4,
      scaled(baroAlt ?? geoAlt, M_TO_FT),
      scaled(velocity, MPS_TO_KT),
      scaled(track, 1),
      scaled(verticalRate, MPS_TO_FPM),
    ]);
  }
  return rows;
}

async function loadWorld(): Promise<WorldResponse> {
  const response = await fetch('https://opensky-network.org/api/states/all', {
    headers: { 'user-agent': 'mirante (github.com/PauloMatiasxvs/mirante)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenSky returned ${response.status}`);
  const data = (await response.json()) as { time: number; states: StateVector[] | null };
  return {
    updatedAt: new Date().toISOString(),
    positionTime: data.time * 1000,
    source: 'opensky',
    flights: toWorldRows(data.states ?? []),
  };
}

export default cachedRoute(loadWorld, {
  name: 'world',
  cacheMs: 15 * 60_000,
  cacheControl: 'public, max-age=300, s-maxage=900, stale-while-revalidate=1800',
});
