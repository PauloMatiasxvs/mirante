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
  name: 'military',
  cacheMs: 120_000,
  cacheControl: 'public, max-age=60, s-maxage=120, stale-while-revalidate=240',
});
