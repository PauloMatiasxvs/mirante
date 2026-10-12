import { forward } from 'mgrs';

/** "23KLP33289464" -> "23K LP 3328 9464" */
export function formatMgrs(lat: number, lon: number, digits = 4): string {
  if (lat < -80 || lat > 84) return '—';
  const raw = forward([lon, lat], digits);
  const match = raw.match(/^(\d{1,2}[A-Z])([A-Z]{2})(\d+)$/);
  if (!match) return raw;
  const [, zone, square, numbers] = match;
  const half = numbers.length / 2;
  return `${zone} ${square} ${numbers.slice(0, half)} ${numbers.slice(half)}`;
}

/** Rough continent or ocean for a point, for the HUD summary line. */
export function regionName(lat: number, lon: number): string {
  if (lat > 72) return 'ÁRTICO';
  if (lat < -60) return 'ANTÁRTICA';
  if (lon >= -170 && lon <= -50 && lat >= 13) return 'AMÉRICA DO NORTE';
  if (lon >= -92 && lon <= -60 && lat >= 7 && lat < 13) return 'AMÉRICA CENTRAL';
  if (lon >= -82 && lon <= -34 && lat < 13) return 'AMÉRICA DO SUL';
  if (lon >= -25 && lon <= 45 && lat >= 35) return 'EUROPA';
  // Africa narrows south of the equator: its Atlantic coast sits near 10°E.
  if (lat < 35 && lat >= 5 && lon >= -18 && lon <= 52) return 'ÁFRICA';
  if (lat < 5 && lat >= -35 && lon >= 8 && lon <= 52) return 'ÁFRICA';
  if (lon >= 45 && lon <= 180 && lat >= 5) return 'ÁSIA';
  if (lon >= 110 && lon <= 180 && lat < 5) return 'OCEANIA';
  return lat >= 0 ? 'OCEANO · HEMISFÉRIO NORTE' : 'OCEANO · HEMISFÉRIO SUL';
}

/** Altitude band of the camera, for the HUD summary line. */
export function altitudeBand(heightM: number): string {
  if (heightM < 1_500) return 'RUA';
  if (heightM < 8_000) return 'CIDADE';
  if (heightM < 60_000) return 'METRÓPOLE';
  if (heightM < 600_000) return 'REGIONAL';
  return 'GLOBAL';
}

export interface City {
  name: string;
  lat: number;
  lon: number;
}

const RAD = Math.PI / 180;

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const dLat = (bLat - aLat) * RAD;
  const dLon = (bLon - aLon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestCity(lat: number, lon: number, cities: City[], maxKm = 150) {
  let best: { name: string; distanceKm: number } | null = null;
  for (const city of cities) {
    const distance = distanceKm(lat, lon, city.lat, city.lon);
    if (distance <= maxKm && (!best || distance < best.distanceKm)) best = { name: city.name, distanceKm: distance };
  }
  return best;
}
