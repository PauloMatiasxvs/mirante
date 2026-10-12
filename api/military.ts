import { fetchAdsb } from './_lib/adsb.js';
import { cachedRoute } from './_lib/cachedRoute.js';
import { mergeAircraft, type FlightsResponse } from './_lib/flight.js';

// Military aircraft broadcasting ADS-B anywhere in the world (adsb.lol /v2/mil).

async function loadMilitary(): Promise<FlightsResponse> {
  return {
    updatedAt: new Date().toISOString(),
    source: 'adsb.lol',
    partial: false,
    flights: mergeAircraft([await fetchAdsb('mil')]),
  };
}

export default cachedRoute(loadMilitary, {
  cacheMs: 60_000,
  cacheControl: 'public, max-age=30, s-maxage=60, stale-while-revalidate=120',
});
