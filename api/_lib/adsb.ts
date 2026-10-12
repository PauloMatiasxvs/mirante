import type { RawAircraft } from './flight.js';

// adsb.lol is free and rate-limits aggressively; once it pushes back, every
// route that uses it waits out the same backoff window.
const TIMEOUT_MS = 10_000;
const BACKOFF_MS = 60_000;

let blockedUntil = 0;

export class RateLimitError extends Error {}

export async function fetchAdsb(path: string): Promise<RawAircraft[]> {
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
