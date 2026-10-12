import { cachedRoute } from './_lib/cachedRoute.js';

// Every airborne aircraft OpenSky sees worldwide. The free quota allows only a
// few hundred whole-world queries a day, so the snapshot is refreshed every
// 15 minutes and the client dead-reckons each plane in between.

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

const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

let token: { value: string; expiresAt: number } | null = null;

// OpenSky blocks anonymous requests from cloud providers (Vercel included).
// With OPENSKY_CLIENT_ID/SECRET set, requests go out authenticated instead.
async function authHeader(): Promise<Record<string, string>> {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  if (!token || Date.now() > token.expiresAt) {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`OpenSky auth returned ${response.status}`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  }
  return { authorization: `Bearer ${token.value}` };
}

async function loadWorld(): Promise<WorldResponse> {
  const response = await fetch('https://opensky-network.org/api/states/all', {
    headers: { 'user-agent': 'mirante (github.com/PauloMatiasxvs/mirante)', ...(await authHeader()) },
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
