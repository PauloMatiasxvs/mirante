// Builds the Portuguese place names (countries, cities, seas) and the border
// lines from Natural Earth, which is public domain.
//
//   npm run data:basemap

import { mkdir, writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

async function load(name) {
  const response = await fetch(`${BASE}/${name}.geojson`);
  if (!response.ok) throw new Error(`Natural Earth returned ${response.status} for ${name}`);
  return (await response.json()).features;
}

const round = (value, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;

const flatLines = (geometry) =>
  (geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates).map((line) =>
    line.flatMap(([lon, lat]) => [round(lon), round(lat)]),
  );

function bounds(geometry) {
  const points = geometry.coordinates.flat(geometry.type === 'Polygon' ? 1 : 2);
  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return { west: Math.min(...lons), east: Math.max(...lons), south: Math.min(...lats), north: Math.max(...lats) };
}

// Oceans are too large (and some cross the antimeridian) for a bounding-box
// center to land anywhere sensible, so their labels are placed by hand.
const OCEANS = [
  ['Oceano Atlântico', -38, 28],
  ['Oceano Atlântico', -18, -22],
  ['Oceano Pacífico', -145, 20],
  ['Oceano Pacífico', -115, -25],
  ['Oceano Índico', 78, -22],
  ['Oceano Ártico', -20, 84],
  ['Oceano Antártico', 20, -62],
];

const [countries, places, seas, borders, states] = await Promise.all([
  load('ne_110m_admin_0_countries'),
  load('ne_50m_populated_places'),
  load('ne_110m_geography_marine_polys'),
  load('ne_50m_admin_0_boundary_lines_land'),
  load('ne_50m_admin_1_states_provinces_lines'),
]);

const labels = {
  // [name, lon, lat, minLabel]
  countries: countries.map(({ properties: p }) => [p.NAME_PT || p.NAME, round(p.LABEL_X, 2), round(p.LABEL_Y, 2), p.MIN_LABEL]),
  // [name, lon, lat, scaleRank, isBrazil]
  cities: places.map(({ properties: p }) => [
    p.NAME_PT || p.NAME,
    round(p.LONGITUDE),
    round(p.LATITUDE),
    p.SCALERANK,
    p.ADM0NAME === 'Brazil' ? 1 : 0,
  ]),
  // [name, lon, lat, scaleRank]
  seas: [
    ...OCEANS.map(([name, lon, lat]) => [name, lon, lat, 0]),
    ...seas
      .filter(({ properties: p }) => p.scalerank === 1 && (p.name_pt || p.name))
      .map(({ properties: p, geometry }) => [p, bounds(geometry)])
      .filter(([, b]) => b.east - b.west < 90)
      .map(([p, b]) => [p.name_pt || p.name, round((b.west + b.east) / 2, 2), round((b.south + b.north) / 2, 2), p.scalerank]),
  ],
};

const lines = {
  countries: borders.flatMap(({ geometry }) => flatLines(geometry)),
  states: states.filter(({ properties: p }) => p.ADM0_A3 === 'BRA').flatMap(({ geometry }) => flatLines(geometry)),
};

const dir = new URL('../public/data/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('labels.json', dir), JSON.stringify(labels));
await writeFile(new URL('borders.json', dir), JSON.stringify(lines));
console.log(
  `${labels.countries.length} countries, ${labels.cities.length} cities, ${labels.seas.length} seas, ` +
    `${lines.countries.length} border lines, ${lines.states.length} state lines`,
);
