import {
  Cartesian3,
  Cartographic,
  Color,
  ColorGeometryInstanceAttribute,
  EllipsoidTerrainProvider,
  GeometryInstance,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  Primitive,
  PrimitiveCollection,
  sampleTerrain,
  ShadowMode,
  type TerrainProvider,
  type Viewer,
} from 'cesium';
import cities from '../../data/cities.json';
import type { CityId, LayerStatus, MapLayer } from '../types';

// [height, base, lon1, lat1, lon2, lat2, ...]
type Building = number[];

const LOAD_DISTANCE_M = 30_000;
const TERRAIN_LEVEL = 13; // ~20 m resolution, plenty for building bases
const LOW = Color.fromCssColorString('#e7ebf0');
const HIGH = Color.fromCssColorString('#a9cdf5');

export interface BuildingsLayer extends MapLayer {
  load(city: CityId): Promise<number>;
}

const colorForHeight = (height: number) =>
  Color.lerp(LOW, HIGH, Math.min(1, Math.max(0, (height - 10) / 110)), new Color());

function footprintCenter(building: Building): Cartographic {
  let lon = 0;
  let lat = 0;
  const count = (building.length - 2) / 2;
  for (let i = 2; i < building.length; i += 2) {
    lon += building[i];
    lat += building[i + 1];
  }
  return Cartographic.fromDegrees(lon / count, lat / count);
}

// Ground height under each building; falls back to the average of the
// samples that worked (or zero without terrain).
async function groundHeights(terrain: TerrainProvider, buildings: Building[]): Promise<number[]> {
  const points = buildings.map(footprintCenter);
  if (terrain instanceof EllipsoidTerrainProvider) return points.map(() => 0);
  try {
    await sampleTerrain(terrain, TERRAIN_LEVEL, points);
  } catch (error) {
    console.warn('terrain unavailable for buildings:', error);
  }
  const valid = points.map((p) => p.height).filter(Number.isFinite);
  const fallback = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  return points.map((p) => (Number.isFinite(p.height) ? p.height : fallback));
}

export function createBuildingsLayer(
  viewer: Viewer,
  terrainReady: Promise<void>,
  onStatus: (status: LayerStatus) => void,
): BuildingsLayer {
  const collection = viewer.scene.primitives.add(new PrimitiveCollection()) as PrimitiveCollection;
  const loaded = new Map<CityId, Promise<number>>();
  let total = 0;
  let destroyed = false;

  async function build(city: CityId): Promise<number> {
    const response = await fetch(`/data/buildings/${city}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { buildings } = (await response.json()) as { buildings: Building[] };
    await terrainReady;
    const ground = await groundHeights(viewer.scene.terrainProvider, buildings);
    if (destroyed) return 0;

    collection.add(
      new Primitive({
        geometryInstances: buildings.map(
          (building, i) =>
            new GeometryInstance({
              geometry: new PolygonGeometry({
                polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(building.slice(2))),
                height: ground[i] + building[1],
                extrudedHeight: ground[i] + building[0],
                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
              }),
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(colorForHeight(building[0])) },
            }),
        ),
        appearance: new PerInstanceColorAppearance({ translucent: false, closed: true }),
        shadows: ShadowMode.ENABLED,
      }),
    );
    total += buildings.length;
    onStatus({ count: total, error: false });
    return buildings.length;
  }

  function load(city: CityId) {
    let promise = loaded.get(city);
    if (!promise) {
      promise = build(city);
      loaded.set(city, promise);
      promise.catch((error) => {
        console.warn(`buildings for ${city} unavailable:`, error);
        loaded.delete(city);
        onStatus({ count: total || null, error: total === 0 });
      });
    }
    return promise;
  }

  // Load whichever featured city the camera gets close to.
  const removeMoveListener = viewer.camera.moveEnd.addEventListener(() => {
    const camera = viewer.camera.positionWC;
    if (viewer.camera.positionCartographic.height > LOAD_DISTANCE_M) return;
    for (const [id, { target }] of Object.entries(cities)) {
      if (Cartesian3.distance(camera, Cartesian3.fromDegrees(target.lon, target.lat)) < LOAD_DISTANCE_M) {
        void load(id as CityId).catch(() => {});
      }
    }
  });

  onStatus({ count: 0, error: false });

  return {
    id: 'buildings',
    entityPrefix: 'building-',
    load,
    setVisible(visible) {
      collection.show = visible;
    },
    describe: () => null,
    destroy() {
      destroyed = true;
      removeMoveListener();
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(collection);
    },
  };
}
