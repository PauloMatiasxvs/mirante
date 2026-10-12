import { fetchAdsb, RateLimitError } from './_lib/adsb.js';
import { cachedRoute } from './_lib/cachedRoute.js';
import { mergeAircraft, type FlightsResponse, type RawAircraft } from './_lib/flight.js';

// Live flights over Brazil. adsb.lol doesn't send CORS headers, so the browser
// goes through this route (a Vercel function, or the Vite server locally).

// Search circles, 250 nm each. Receiver coverage in Brazil is concentrated in
// the Southeast; the first circle reaches São Paulo, Rio, BH and Curitiba.
const REGIONS = [
  { name: 'Sudeste', lat: -22.8, lon: -45.5 },
  { name: 'Brasília', lat: -15.8, lon: -47.9 },
  { name: 'Fortaleza', lat: -3.78, lon: -38.53 },
];

async function loadFlights(): Promise<FlightsResponse> {
  const batches: RawAircraft[][] = [];
  let failures = 0;
  // fetchAdsb already spaces requests out, one region at a time.
  for (const { name, lat, lon } of REGIONS) {
    try {
      batches.push(await fetchAdsb(`lat/${lat}/lon/${lon}/dist/250`));
    } catch (error) {
      failures++;
      console.warn(`flights ${name}: ${(error as Error).message}`);
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

export default cachedRoute(loadFlights, {
  cacheMs: 45_000,
  cacheControl: 'public, max-age=20, s-maxage=45, stale-while-revalidate=60',
});
