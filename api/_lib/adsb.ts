import type { RawAircraft } from './flight.js';

// adsb.lol is free and rate-limits aggressively. Every route shares this one
// queue, so requests go out one at a time with a gap between them, and once
// the API pushes back they all wait out the same backoff window.
const TIMEOUT_MS = 10_000;
// It allows a short burst, then roughly one request every 8-10 s.
const MIN_GAP_MS = 8_000;
const BACKOFF_MS = 60_000;

let blockedUntil = 0;
let queue: Promise<unknown> = Promise.resolve();

export class RateLimitError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path: string): Promise<RawAircraft[]> {
  if (Date.now() < blockedUntil) throw new RateLimitError('waiting for adsb.lol rate limit');
  const response = await fetch(`https://api.adsb.lol/v2/${path}`, {
    headers: { 'user-agent': 'mirante (github.com/PauloMatiasxvs/mirante)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 420 || response.status === 429) {
    blockedUntil = Date.now() + BACKOFF_MS;
    throw new RateLimitError('adsb.lol rate limit');
  }
  if (!response.ok) throw new Error(`adsb.lol returned ${response.status}`);
  const data = (await response.json()) as { ac?: RawAircraft[] };
  return Array.isArray(data.ac) ? data.ac : [];
}

export function fetchAdsb(path: string): Promise<RawAircraft[]> {
  const result = queue.then(() => request(path));
  // The next request starts MIN_GAP_MS after this one settles, success or not.
  queue = result.catch(() => {}).then(() => sleep(MIN_GAP_MS));
  return result;
}
