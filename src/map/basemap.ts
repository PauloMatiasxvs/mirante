import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  HorizontalOrigin,
  LabelCollection,
  LabelStyle,
  Material,
  PointPrimitiveCollection,
  PolylineMaterialAppearance,
  VerticalOrigin,
  type Scene,
} from 'cesium';

import type { City } from '../lib/place';

// Place names in Portuguese and border lines, drawn from Natural Earth data.
// The keyless label tile layers available are English-only.

interface Labels {
  countries: Array<[name: string, lon: number, lat: number, minLabel: number]>;
  cities: Array<[name: string, lon: number, lat: number, rank: number, isBrazil: 0 | 1]>;
  seas: Array<[name: string, lon: number, lat: number, rank: number]>;
}

interface Borders {
  countries: number[][];
  states: number[][];
}

const WHITE = Color.WHITE;
const OUTLINE = Color.BLACK.withAlpha(0.85);
const SEA = Color.fromCssColorString('#bae6fd').withAlpha(0.8);
const CITY = Color.fromCssColorString('#e2e8f0');

const TEXT_STYLE = {
  outlineColor: OUTLINE,
  outlineWidth: 3,
  style: LabelStyle.FILL_AND_OUTLINE,
  horizontalOrigin: HorizontalOrigin.CENTER,
};

// Max camera distance (m) at which each name shows, by importance.
function countryRange(minLabel: number) {
  if (minLabel <= 2) return 3.5e7;
  if (minLabel <= 3) return 1.6e7;
  if (minLabel <= 4) return 9e6;
  return 5e6;
}

function cityRange(rank: number, isBrazil: boolean) {
  const range = rank <= 1 ? 6e6 : rank <= 3 ? 3e6 : rank <= 5 ? 1.4e6 : 7e5;
  return isBrazil ? range * 2 : range;
}

function drawLines(scene: Scene, lines: number[][], width: number, color: Color) {
  scene.groundPrimitives.add(
    new GroundPolylinePrimitive({
      geometryInstances: lines
        .filter((line) => line.length >= 4)
        .map(
          (line) =>
            new GeometryInstance({
              geometry: new GroundPolylineGeometry({ positions: Cartesian3.fromDegreesArray(line), width }),
            }),
        ),
      appearance: new PolylineMaterialAppearance({ material: Material.fromType('Color', { color }) }),
    }),
  );
}

/** Draws names and borders; resolves with the city list for place lookups. */
export async function addBasemap(scene: Scene): Promise<City[]> {
  const [labels, borders] = (await Promise.all(
    ['/data/labels.json', '/data/borders.json'].map((url) => fetch(url).then((r) => r.json())),
  )) as [Labels, Borders];
  if (scene.isDestroyed()) return [];

  drawLines(scene, borders.countries, 1.5, WHITE.withAlpha(0.55));
  drawLines(scene, borders.states, 1, WHITE.withAlpha(0.28));

  const texts = scene.primitives.add(new LabelCollection()) as LabelCollection;
  const dots = scene.primitives.add(new PointPrimitiveCollection()) as PointPrimitiveCollection;

  for (const [name, lon, lat, minLabel] of labels.countries) {
    texts.add({
      ...TEXT_STYLE,
      position: Cartesian3.fromDegrees(lon, lat, 8_000),
      text: name.toUpperCase(),
      font: '600 13px Inter, sans-serif',
      fillColor: WHITE.withAlpha(0.92),
      verticalOrigin: VerticalOrigin.CENTER,
      distanceDisplayCondition: new DistanceDisplayCondition(8e5, countryRange(minLabel)),
    });
  }

  for (const [name, lon, lat] of labels.seas) {
    texts.add({
      ...TEXT_STYLE,
      position: Cartesian3.fromDegrees(lon, lat),
      text: name,
      font: 'italic 500 13px Inter, sans-serif',
      fillColor: SEA,
      verticalOrigin: VerticalOrigin.CENTER,
      distanceDisplayCondition: new DistanceDisplayCondition(2e6, 4e7),
    });
  }

  for (const [name, lon, lat, rank, isBrazil] of labels.cities) {
    // Lifted off the ground so terrain doesn't hide them; Brazilian cities
    // sit lower than Andean ones.
    const position = Cartesian3.fromDegrees(lon, lat, isBrazil ? 1_500 : 4_500);
    const visible = new DistanceDisplayCondition(25_000, cityRange(rank, Boolean(isBrazil)));
    dots.add({
      position,
      pixelSize: rank <= 1 ? 5 : 4,
      color: WHITE.withAlpha(0.9),
      outlineColor: OUTLINE,
      outlineWidth: 1,
      distanceDisplayCondition: visible,
    });
    texts.add({
      ...TEXT_STYLE,
      position,
      text: name,
      font: `${rank <= 1 ? 600 : 500} 12px Inter, sans-serif`,
      fillColor: CITY,
      verticalOrigin: VerticalOrigin.BOTTOM,
      pixelOffset: new Cartesian2(0, -7),
      distanceDisplayCondition: visible,
    });
  }

  return labels.cities.map(([name, lon, lat]) => ({ name, lat, lon }));
}
