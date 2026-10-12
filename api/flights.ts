import type { IncomingMessage, ServerResponse } from 'node:http';

// adsb.lol doesn't send CORS headers, so the browser goes through this route.
// It runs as a Vercel function in production and on the Vite dev server locally.

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
}

export interface FlightsResponse {
  updatedAt: string;
  source: 'adsb.lol';
  partial: boolean;
  flights: Flight[];
}

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

// Search circles, 250 nm each. Receiver coverage in Brazil is concentrated in
// the Southeast; the first circle reaches São Paulo, Rio, BH and Curitiba.
const REGIONS = [
  { name: 'Sudeste', lat: -22.8, lon: -45.5 },
  { name: 'Brasília', lat: -15.8, lon: -47.9 },
  { name: 'Fortaleza', lat: -3.78, lon: -38.53 },
];

// The API is free and rate-limits aggressively: query one region at a time
// and cache the merged result.
const CACHE_MS = 45_000;
const REGION_PAUSE_MS = 2_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const TIMEOUT_MS = 10_000;

let cache: { at: number; body: string } | null = null;
let inFlight: Promise<FlightsResponse> | null = null;
let blockedUntil = 0;

class RateLimitError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const finite = (value: unknown): number | null =>
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

// Regions overlap, so the same aircraft can show up twice: keep the freshest fix.
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

async function fetchRegion({ lat, lon }: { lat: number; lon: number }): Promise<RawAircraft[]> {
  const response = await fetch(`https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`, {
    headers: { 'user-agent': 'mirante (github.com/PauloMatiasxvs/mirante)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 420 || response.status === 429) {
    blockedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
    throw new RateLimitError('adsb.lol rate limit');
  }
  if (!response.ok) throw new Error(`adsb.lol returned ${response.status}`);
  const data = (await response.json()) as { ac?: RawAircraft[] };
  return Array.isArray(data.ac) ? data.ac : [];
}

async function loadFlights(): Promise<FlightsResponse> {
  if (Date.now() < blockedUntil) throw new Error('waiting for adsb.lol rate limit');

  const batches: RawAircraft[][] = [];
  let failures = 0;
  for (const [index, region] of REGIONS.entries()) {
    if (index > 0) await sleep(REGION_PAUSE_MS);
    try {
      batches.push(await fetchRegion(region));
    } catch (error) {
      failures++;
      console.warn(`flights ${region.name}: ${(error as Error).message}`);
      if (error instanceof RateLimitError) break;
    }
  }
  if (batches.length === 0) throw new Error('adsb.lol unavailable');

  return {
    updatedAt: new Date().toISOString(),
    source: 'adsb.lol',
    partial: failures > 0,
    flights: mergeAircraft(batches),
  };
}

function sendJson(res: ServerResponse, status: number, body: string, cacheControl: string) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', cacheControl);
  res.end(body);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('allow', 'GET');
    res.end();
    return;
  }

  const cacheControl = 'public, max-age=20, s-maxage=45, stale-while-revalidate=60';
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      inFlight ??= loadFlights().finally(() => {
        inFlight = null;
      });
      cache = { at: Date.now(), body: JSON.stringify(await inFlight) };
    }
    sendJson(res, 200, cache.body, cacheControl);
  } catch (error) {
    console.error('flights:', (error as Error).message);
    // A stale sky beats an empty one.
    if (cache) sendJson(res, 200, cache.body, cacheControl);
    else sendJson(res, 502, JSON.stringify({ error: 'flight source unavailable' }), 'no-store');
  }
}
