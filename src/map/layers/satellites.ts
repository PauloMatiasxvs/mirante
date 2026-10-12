import {
  ArcType,
  Cartesian3,
  Color,
  ConstantProperty,
  CustomDataSource,
  JulianDate,
  LabelCollection,
  LagrangePolynomialApproximation,
  NearFarScalar,
  PointPrimitiveCollection,
  PolylineGlowMaterialProperty,
  SampledPositionProperty,
  type Label,
  type PointPrimitive,
  type Viewer,
} from 'cesium';
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from 'satellite.js';
import {
  SATELLITE_GROUPS,
  type SatelliteGroup,
  type SatellitesResponse,
} from '../../../api/_lib/satelliteGroups';
import { formatInt, formatLatLon } from '../../lib/format';
import { parseTle } from '../../lib/tle';
import { tagStyle } from '../tagStyle';
import type { InfoContent, LayerStatus, MapLayer } from '../types';

// Hundreds of satellites as entities would re-interpolate every orbit each
// frame. Instead they're plain point/label primitives moved once a second;
// only the crewed stations stay entities, so "follow the ISS" stays smooth.
const MOVE_INTERVAL_MS = 1_000;
const STATION_RESAMPLE_MS = 60_000;
const SAMPLE_STEP_S = 20;
const DOCKED_DISTANCE_M = 50_000;
const ISS = 25544;
const PREFIX = 'sat-';

const GROUP_STYLE: Record<SatelliteGroup, { color: string; category: string }> = {
  stations: { color: '#f0abfc', category: 'Estação e naves tripuladas' },
  visual: { color: '#c4b5fd', category: 'Visível a olho nu' },
  gnss: { color: '#67e8f9', category: 'Navegação (GPS, Galileo, GLONASS, BeiDou)' },
  weather: { color: '#86efac', category: 'Meteorologia' },
  geo: { color: '#fcd34d', category: 'Geoestacionário' },
};

const STATIONS: Record<number, { label: string; name: string }> = {
  25544: { label: 'ISS', name: 'Estação Espacial Internacional' },
  48274: { label: 'TIANGONG', name: 'Estação Espacial Chinesa (Tiangong)' },
};

interface Satellite {
  name: string;
  norad: number;
  group: SatelliteGroup;
  satrec: SatRec;
  /** Set for everything except the stations, which are entities. */
  point?: PointPrimitive;
  label?: Label;
}

interface Fix {
  lat: number;
  lon: number;
  heightKm: number;
  speedKms: number;
}

export interface SatellitesLayer extends MapLayer {
  followIss(): boolean;
  /** Hides the name tags (the cockpit's sky would be full of them). */
  setLabelsVisible(visible: boolean): void;
}

function fixAt(satrec: SatRec, date: Date): Fix | null {
  const state = propagate(satrec, date);
  if (!state || !state.position || typeof state.position !== 'object' || !state.velocity) return null;
  const geo = eciToGeodetic(state.position, gstime(date));
  const { x, y, z } = state.velocity as { x: number; y: number; z: number };
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    heightKm: geo.height,
    speedKms: Math.hypot(x, y, z),
  };
}

const toCartesian = (fix: Fix) => Cartesian3.fromDegrees(fix.lon, fix.lat, fix.heightKm * 1000);

export function createSatellitesLayer(viewer: Viewer, onStatus: (status: LayerStatus) => void): SatellitesLayer {
  const { scene } = viewer;
  const dataSource = new CustomDataSource('satellites');
  void viewer.dataSources.add(dataSource);
  const points = scene.primitives.add(new PointPrimitiveCollection()) as PointPrimitiveCollection;
  const labels = scene.primitives.add(new LabelCollection()) as LabelCollection;
  const satellites = new Map<string, Satellite>();
  const abort = new AbortController();
  const timers: number[] = [];
  let visible = true;
  let labelsVisible = true;

  function addStation(id: string, satellite: Satellite) {
    const { color } = GROUP_STYLE[satellite.group];
    dataSource.entities.add({
      id,
      position: new SampledPositionProperty(),
      viewFrom: new Cartesian3(0, -1_800_000, 1_100_000),
      point: {
        pixelSize: 11,
        color: Color.fromCssColorString(color),
        outlineColor: Color.BLACK.withAlpha(0.6),
        outlineWidth: 2,
      },
      label: {
        ...tagStyle(color, { offsetY: -4, fadeFrom: 3e6, fadeTo: 6e7 }),
        text: STATIONS[satellite.norad].label,
      },
    });
  }

  function addPrimitive(id: string, satellite: Satellite) {
    const { color } = GROUP_STYLE[satellite.group];
    satellite.point = points.add({
      id,
      pixelSize: 4,
      color: Color.fromCssColorString(color),
      outlineColor: Color.BLACK.withAlpha(0.6),
      outlineWidth: 1,
      scaleByDistance: new NearFarScalar(1e6, 1.4, 6e7, 0.8),
    });
    // Hidden until move() gives it a real position.
    satellite.label = labels.add({
      ...tagStyle(color, { offsetY: -4, fadeFrom: 3e6, fadeTo: 6e7 }),
      id,
      position: Cartesian3.ZERO,
      show: false,
      text: satellite.name,
    });
  }

  // Docked vehicles (Soyuz, Progress, Dragon...) share the station's position
  // and only add overlapping labels.
  function stationPositions(date: Date) {
    return [...satellites.values()]
      .filter((s) => STATIONS[s.norad])
      .map((s) => fixAt(s.satrec, date))
      .filter((fix): fix is Fix => fix !== null)
      .map(toCartesian);
  }

  function move() {
    const date = new Date();
    const stations = stationPositions(date);
    for (const satellite of satellites.values()) {
      if (!satellite.point || !satellite.label) continue;
      const fix = fixAt(satellite.satrec, date);
      const position = fix && toCartesian(fix);
      const docked = position && stations.some((s) => Cartesian3.distance(s, position) < DOCKED_DISTANCE_M);
      const show = Boolean(position) && !docked;
      satellite.point.show = show;
      satellite.label.show = show && labelsVisible;
      if (position) {
        satellite.point.position = position;
        satellite.label.position = position;
      }
    }
    if (visible) scene.requestRender();
  }

  // The stations get a few minutes of orbit ahead; Cesium interpolates.
  function resampleStations() {
    const now = Date.now();
    for (const [id, satellite] of satellites) {
      if (!STATIONS[satellite.norad]) continue;
      const entity = dataSource.entities.getById(id);
      if (!entity) continue;
      const position = new SampledPositionProperty();
      position.setInterpolationOptions({
        interpolationDegree: 3,
        interpolationAlgorithm: LagrangePolynomialApproximation,
      });
      for (let s = -60; s <= 180; s += SAMPLE_STEP_S) {
        const date = new Date(now + s * 1000);
        const fix = fixAt(satellite.satrec, date);
        if (fix) position.addSample(JulianDate.fromDate(date), toCartesian(fix));
      }
      entity.position = position;
    }
    drawIssOrbit(now);
  }

  // The ISS's next full lap around the Earth (~93 min).
  function drawIssOrbit(now: number) {
    const iss = satellites.get(PREFIX + ISS);
    if (!iss) return;
    const orbit: Cartesian3[] = [];
    for (let s = 0; s <= 93 * 60; s += 30) {
      const fix = fixAt(iss.satrec, new Date(now + s * 1000));
      if (fix) orbit.push(toCartesian(fix));
    }
    dataSource.entities.removeById('iss-orbit');
    dataSource.entities.add({
      id: 'iss-orbit',
      polyline: {
        positions: orbit,
        width: 3,
        arcType: ArcType.NONE,
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Color.fromCssColorString('#f0abfc').withAlpha(0.8),
        }),
      },
    });
  }

  async function load() {
    try {
      const response = await fetch('/api/satellites', { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { groups } = (await response.json()) as SatellitesResponse;
      // Groups overlap (the ISS is also "visual"); the first group listed wins.
      for (const group of SATELLITE_GROUPS) {
        for (const tle of parseTle(groups[group] ?? '')) {
          const id = PREFIX + tle.norad;
          if (satellites.has(id)) continue;
          const satellite: Satellite = {
            name: tle.name,
            norad: tle.norad,
            group,
            satrec: twoline2satrec(tle.line1, tle.line2),
          };
          satellites.set(id, satellite);
          if (STATIONS[tle.norad]) addStation(id, satellite);
          else addPrimitive(id, satellite);
        }
      }
      if (!satellites.size) throw new Error('no satellites loaded');
      resampleStations();
      move();
      timers.push(window.setInterval(move, MOVE_INTERVAL_MS));
      timers.push(window.setInterval(resampleStations, STATION_RESAMPLE_MS));
      onStatus({ count: satellites.size, error: false });
    } catch (error) {
      if (abort.signal.aborted) return;
      console.warn('satellites unavailable:', error);
      onStatus({ count: null, error: true });
    }
  }

  void load();

  return {
    id: 'satellites',
    idPrefix: PREFIX,
    setVisible(show) {
      visible = show;
      dataSource.show = show;
      points.show = show;
      labels.show = show;
    },
    setLabelsVisible(show) {
      if (show === labelsVisible) return;
      labelsVisible = show;
      labels.show = show && visible;
      for (const entity of dataSource.entities.values) {
        if (entity.label) entity.label.show = new ConstantProperty(show);
      }
    },
    followIss() {
      const iss = dataSource.entities.getById(PREFIX + ISS);
      if (!iss) return false;
      viewer.trackedEntity = iss;
      viewer.selectedEntity = iss;
      return true;
    },
    describe(id: string): InfoContent | null {
      const satellite = satellites.get(id);
      const fix = satellite && fixAt(satellite.satrec, new Date());
      if (!satellite || !fix) return null;
      const station = STATIONS[satellite.norad];
      return {
        kind: station ? 'Estação espacial' : 'Satélite',
        title: station?.name ?? satellite.name,
        rows: [
          ['Categoria', GROUP_STYLE[satellite.group].category],
          ['Altitude', `${formatInt(fix.heightKm)} km`],
          ['Velocidade', `${formatInt(fix.speedKms * 3600)} km/h`],
          ['Sobre', formatLatLon(fix.lat, fix.lon)],
          ['Catálogo NORAD', String(satellite.norad)],
        ],
        link: {
          url: `https://celestrak.org/satcat/records.php?CATNR=${satellite.norad}`,
          label: 'Ficha no CelesTrak ↗',
        },
      };
    },
    destroy() {
      abort.abort();
      timers.forEach((timer) => window.clearInterval(timer));
      viewer.dataSources.remove(dataSource, true);
      if (!viewer.isDestroyed()) {
        scene.primitives.remove(points);
        scene.primitives.remove(labels);
      }
    },
  };
}
