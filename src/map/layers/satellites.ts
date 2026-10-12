import {
  ArcType,
  Cartesian3,
  Color,
  CustomDataSource,
  JulianDate,
  LagrangePolynomialApproximation,
  NearFarScalar,
  PolylineGlowMaterialProperty,
  SampledPositionProperty,
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
import { SATELLITE_GROUPS, type SatelliteGroup, type SatellitesResponse } from '../../../api/satellites';
import { formatInt, formatLatLon } from '../../lib/format';
import { parseTle } from '../../lib/tle';
import { tagStyle } from '../tagStyle';
import type { InfoContent, LayerStatus, MapLayer } from '../types';

const SAMPLE_STEP_S = 20;
const RESAMPLE_MS = 60_000;
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
}

interface Fix {
  lat: number;
  lon: number;
  heightKm: number;
  speedKms: number;
}

export interface SatellitesLayer extends MapLayer {
  followIss(): boolean;
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
  const dataSource = new CustomDataSource('satellites');
  void viewer.dataSources.add(dataSource);
  const satellites = new Map<string, Satellite>();
  const abort = new AbortController();
  let timer: number | undefined;

  function addEntity(id: string, satellite: Satellite) {
    const station = STATIONS[satellite.norad];
    const { color } = GROUP_STYLE[satellite.group];
    dataSource.entities.add({
      id,
      position: new SampledPositionProperty(),
      viewFrom: new Cartesian3(0, -1_800_000, 1_100_000),
      point: {
        pixelSize: station ? 11 : 4,
        color: Color.fromCssColorString(color),
        outlineColor: Color.BLACK.withAlpha(0.6),
        outlineWidth: station ? 2 : 1,
        scaleByDistance: new NearFarScalar(1e6, 1.4, 6e7, 0.8),
      },
      label: {
        ...tagStyle(color, { offsetY: -4, fadeFrom: 3e6, fadeTo: 6e7 }),
        text: station?.label ?? satellite.name,
      },
    });
  }

  // Docked vehicles (Soyuz, Progress, Dragon...) share the station's position
  // and only add overlapping labels.
  function isDocked(satellite: Satellite, stations: Cartesian3[], date: Date) {
    if (STATIONS[satellite.norad]) return false;
    const fix = fixAt(satellite.satrec, date);
    return fix !== null && stations.some((s) => Cartesian3.distance(s, toCartesian(fix)) < DOCKED_DISTANCE_M);
  }

  // A few minutes of orbit ahead; Cesium interpolates between samples.
  function resample() {
    const now = Date.now();
    const stations = [...satellites.values()]
      .filter((s) => STATIONS[s.norad])
      .map((s) => fixAt(s.satrec, new Date(now)))
      .filter((fix): fix is Fix => fix !== null)
      .map(toCartesian);

    for (const [id, satellite] of satellites) {
      const entity = dataSource.entities.getById(id);
      if (!entity) continue;
      if (isDocked(satellite, stations, new Date(now))) {
        entity.show = false;
        continue;
      }
      const position = new SampledPositionProperty();
      position.setInterpolationOptions({
        interpolationDegree: 3,
        interpolationAlgorithm: LagrangePolynomialApproximation,
      });
      let samples = 0;
      for (let s = -60; s <= 180; s += SAMPLE_STEP_S) {
        const date = new Date(now + s * 1000);
        const fix = fixAt(satellite.satrec, date);
        if (!fix) continue;
        position.addSample(JulianDate.fromDate(date), toCartesian(fix));
        samples++;
      }
      entity.show = samples >= 4;
      if (entity.show) entity.position = position;
    }
    drawIssOrbit(now);
  }

  // The ISS's next full lap around the Earth (~93 min).
  function drawIssOrbit(now: number) {
    const iss = satellites.get(PREFIX + ISS);
    if (!iss) return;
    const points: Cartesian3[] = [];
    for (let s = 0; s <= 93 * 60; s += 30) {
      const fix = fixAt(iss.satrec, new Date(now + s * 1000));
      if (fix) points.push(toCartesian(fix));
    }
    dataSource.entities.removeById('iss-orbit');
    dataSource.entities.add({
      id: 'iss-orbit',
      polyline: {
        positions: points,
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
          const satellite = { name: tle.name, norad: tle.norad, group, satrec: twoline2satrec(tle.line1, tle.line2) };
          satellites.set(id, satellite);
          addEntity(id, satellite);
        }
      }
      if (!satellites.size) throw new Error('no satellites loaded');
      resample();
      timer = window.setInterval(resample, RESAMPLE_MS);
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
    setVisible(visible) {
      dataSource.show = visible;
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
      window.clearInterval(timer);
      viewer.dataSources.remove(dataSource, true);
    },
  };
}
