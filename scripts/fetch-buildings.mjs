// Downloads building footprints for the featured cities from the OpenStreetMap
// API and writes one compact file per city to public/data/buildings/.
//
//   npm run data:buildings [-- fortaleza sao-paulo ...]
//
// Requests go one at a time with a pause, as the OSM usage policy asks.
// Data © OpenStreetMap contributors (ODbL).

import { mkdir, writeFile } from 'node:fs/promises';
import cities from '../src/data/cities.json' with { type: 'json' };

const API = 'https://api.openstreetmap.org/api/0.6/map';
const USER_AGENT = 'mirante/2.0 (github.com/PauloMatiasxvs/mirante)';
const TILE_DEG = 0.009; // keeps each request under the API node limit
const PAUSE_MS = 2_000;
const METERS_PER_LEVEL = 3.2;

const DEFAULT_HEIGHT = {
  apartments: 12,
  commercial: 12,
  office: 15,
  hotel: 15,
  hospital: 12,
  university: 12,
  school: 8,
  church: 12,
  cathedral: 20,
  retail: 6,
  house: 6,
  residential: 6,
  detached: 6,
  terrace: 6,
  industrial: 8,
  warehouse: 8,
  garage: 3,
  garages: 3,
  shed: 3,
};
const SKIP = new Set(['roof', 'carport', 'construction', 'ruins']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function positive(text) {
  const value = Number.parseFloat(String(text ?? '').replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function heightOf(tags) {
  const meters = positive(tags.height);
  if (meters) return meters;
  const levels = positive(tags['building:levels']);
  if (levels) return (levels + (positive(tags['roof:levels']) ?? 0)) * METERS_PER_LEVEL;
  return DEFAULT_HEIGHT[tags.building] ?? 7;
}

function baseOf(tags) {
  const meters = positive(tags.min_height);
  if (meters) return meters;
  const level = positive(tags['building:min_level']);
  return level ? level * METERS_PER_LEVEL : 0;
}

const decodeEntities = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

function parseOsmXml(xml, nodes, ways) {
  for (const [, id, lat, lon] of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) {
    nodes.set(id, [Number(lon), Number(lat)]);
  }
  for (const [, id, body] of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
    if (ways.has(id)) continue;
    const tags = {};
    for (const [, k, v] of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\s*\/>/g)) {
      tags[decodeEntities(k)] = decodeEntities(v);
    }
    if (!tags.building || SKIP.has(tags.building)) continue;
    ways.set(id, { tags, refs: [...body.matchAll(/<nd ref="(\d+)"\s*\/>/g)].map((m) => m[1]) });
  }
}

async function fetchTile(west, south, east, north) {
  const bbox = [west, south, east, north].map((v) => v.toFixed(5)).join(',');
  const response = await fetch(`${API}?bbox=${bbox}`, { headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`OSM returned ${response.status} for ${bbox}`);
  return response.text();
}

async function fetchCity(id) {
  const { name, area } = cities[id];
  const nodes = new Map();
  const ways = new Map();
  let requests = 0;

  for (let south = area.south; south < area.north - 1e-9; south += TILE_DEG) {
    for (let west = area.west; west < area.east - 1e-9; west += TILE_DEG) {
      if (requests++) await sleep(PAUSE_MS);
      console.log(`  ${name}: tile ${requests}`);
      parseOsmXml(
        await fetchTile(west, south, Math.min(west + TILE_DEG, area.east), Math.min(south + TILE_DEG, area.north)),
        nodes,
        ways,
      );
    }
  }

  // Each building becomes [height, base, lon1, lat1, lon2, lat2, ...], ring not closed.
  const buildings = [];
  for (const { tags, refs } of ways.values()) {
    if (refs.length < 4 || refs[0] !== refs.at(-1)) continue;
    const points = refs.slice(0, -1).map((ref) => nodes.get(ref));
    if (points.some((p) => !p)) continue;
    const top = heightOf(tags);
    buildings.push([
      Math.round(top * 10) / 10,
      Math.round(Math.min(baseOf(tags), top - 1) * 10) / 10,
      ...points.flat().map((v) => Math.round(v * 1e6) / 1e6),
    ]);
  }

  const dir = new URL('../public/data/buildings/', import.meta.url);
  await mkdir(dir, { recursive: true });
  await writeFile(
    new URL(`${id}.json`, dir),
    JSON.stringify({
      city: name,
      source: '© OpenStreetMap contributors (ODbL)',
      fetchedAt: new Date().toISOString().slice(0, 10),
      buildings,
    }),
  );
  console.log(`${name}: ${buildings.length} buildings`);
}

const requested = process.argv.slice(2);
for (const id of requested.length ? requested : Object.keys(cities)) {
  if (!cities[id]) throw new Error(`Unknown city: ${id}`);
  await fetchCity(id);
}
