import { cachedRoute } from './_lib/cachedRoute.js';
import { SATELLITE_GROUPS, type SatelliteGroup, type SatellitesResponse } from './_lib/satelliteGroups.js';

// Orbital elements (TLE) from CelesTrak, merged into one cached response.
// CelesTrak blocks clients that download the same data more than every couple
// of hours, so the browser never talks to it directly: this route caches for
// 2 h in memory and the CDN shares that copy across every visitor.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchGroup(group: SatelliteGroup): Promise<string> {
  const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`, {
    headers: { 'user-agent': 'mirante (github.com/PauloMatiasxvs/mirante)' },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  if (!response.ok || !text.includes('\n1 ')) throw new Error(`CelesTrak ${group} returned ${response.status}`);
  return text;
}

async function loadSatellites(): Promise<SatellitesResponse> {
  const groups: SatellitesResponse['groups'] = {};
  for (const group of SATELLITE_GROUPS) {
    try {
      groups[group] = await fetchGroup(group);
    } catch (error) {
      console.warn((error as Error).message);
    }
    await sleep(500);
  }
  if (Object.keys(groups).length === 0) throw new Error('CelesTrak unavailable');
  return { updatedAt: new Date().toISOString(), groups };
}

export default cachedRoute(loadSatellites, {
  name: 'satellites',
  cacheMs: 2 * 60 * 60_000,
  cacheControl: 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400',
});
